"""
Box User Deprovisioning Job

Nightly cron job (2:00 AM ET) that removes Box demo environment users
who no longer have active or upcoming reservations.

Deployment: Cloud Run Job triggered by Cloud Scheduler.

Logic:
  1. List all managed users in the Box enterprise (filtered to @demospace.altostrat.com)
  2. For each user, check the reservation database for Box-specific reservations
  3. Delete users whose latest Box reservation is COMPLETED and have no
     upcoming Box reservations within the next 24 hours
  4. Send a summary notification email

Environment Variables:
  - DRY_RUN: "true" (default) or "false". When true, no users are actually deleted.
  - GCP_PROJECT_ID: Google Cloud project ID
  - BOX_ENTERPRISE_ID_SECRET_NAME: Secret name for Box enterprise ID
  - BOX_CLIENT_ID_SECRET_NAME: Secret name for Box client ID
  - BOX_CLIENT_SECRET_SECRET_NAME: Secret name for Box client secret
  - DB_USER, DB_HOST, DB_PORT, DB_NAME, DB_PASSWORD_SECRET_NAME: Database connection
  - PORTAL_ADMIN_GROUP_EMAIL: Admin group email for notifications
  - NOTIFICATION_SENDER_EMAIL: Sender email for notifications
  - DELEGATED_ADMIN: Delegated admin for email service
  - ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME: Service account key for email service
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import List, Set

from loguru import logger
from sqlalchemy.orm import Session

from shared_lib.db.models import (
    Application,
    Reservation,
    ReservationStatus,
    reservation_applications_table,
)
from shared_lib.db.session import SessionLocal

from box_service import (
    DEMOSPACE_USER_DOMAIN,
    delete_box_user,
    list_box_enterprise_users,
    setup_box_client,
)
from notification import send_deprovisioning_summary_email


# Look-ahead window for upcoming reservations
RESERVATION_LOOKAHEAD_HOURS = 24


def get_box_application_id(db: Session) -> int:
    """
    Retrieve the application ID for 'Box' from the database.

    Returns:
        The integer ID of the Box application.

    Raises:
        ValueError: If the Box application is not found in the database.
    """
    box_app = db.query(Application).filter(Application.name == "Box").first()
    if not box_app:
        raise ValueError(
            "Box application not found in the database. "
            "Ensure the 'Box' application is registered in the applications table."
        )
    logger.info(f"Box application ID: {box_app.id}")
    return box_app.id


def get_protected_user_emails(
    db: Session, box_app_id: int, now: datetime
) -> dict:
    """
    Find user emails that have an upcoming Box reservation and should NOT be deleted.

    A user is "protected" if they have a PENDING or ACTIVE reservation
    that includes the Box application and:
      - The reservation's end_time is still in the future (hasn't expired yet), AND
      - The reservation's start_time is within the next 24 hours (imminent or active)

    Args:
        db: Database session.
        box_app_id: The application ID for Box.
        now: Current UTC timestamp.

    Returns:
        A dict mapping user_email -> reason string.
    """
    lookahead_cutoff = now + timedelta(hours=RESERVATION_LOOKAHEAD_HOURS)

    # Find reservations that are PENDING or ACTIVE, include the Box app,
    # haven't expired yet, and start within the next 24 hours
    protected_reservations = (
        db.query(Reservation.user_email, Reservation.status)
        .join(
            reservation_applications_table,
            Reservation.id == reservation_applications_table.c.reservation_id,
        )
        .filter(
            reservation_applications_table.c.application_id == box_app_id,
            Reservation.status.in_(
                [ReservationStatus.PENDING, ReservationStatus.ACTIVE]
            ),
            Reservation.end_time > now,
            Reservation.start_time < lookahead_cutoff,
        )
        .all()
    )

    protected_emails = {}
    for email, status in protected_reservations:
        if email in protected_emails:
            continue  # keep the first match
        if status == ReservationStatus.ACTIVE:
            reason = "Has an ACTIVE Box reservation"
        else:
            reason = "Has an upcoming PENDING Box reservation"
        protected_emails[email] = reason

    logger.info(
        f"Found {len(protected_emails)} users with upcoming Box reservations "
        f"(protected from deletion)."
    )
    return protected_emails


def classify_user(
    user_login: str,
    protected_emails: Set[str],
    db: Session,
    box_app_id: int,
) -> tuple:
    """
    Classify a Box user into DELETE or KEEP with a reason.

    Args:
        user_login: The Box user's email/login.
        protected_emails: Set of emails that have upcoming reservations.
        db: Database session.
        box_app_id: The application ID for Box.

    Returns:
        Tuple of (action, reason) where action is "DELETE" or "KEEP".
    """
    # Check if user has upcoming reservations (protected)
    if user_login in protected_emails:
        return (
            "KEEP",
            protected_emails[user_login],
        )

    # Check if user has any Box reservations at all
    has_any_box_reservation = (
        db.query(Reservation.id)
        .join(
            reservation_applications_table,
            Reservation.id == reservation_applications_table.c.reservation_id,
        )
        .filter(
            reservation_applications_table.c.application_id == box_app_id,
            Reservation.user_email == user_login,
        )
        .first()
    )

    if not has_any_box_reservation:
        # Scenario 4: User exists in Box but has no reservations at all
        return "DELETE", "No Box reservations found and no future reservations booked"

    # User has Box reservations but none are upcoming/active
    # Check if latest reservation is COMPLETED
    latest_reservation = (
        db.query(Reservation)
        .join(
            reservation_applications_table,
            Reservation.id == reservation_applications_table.c.reservation_id,
        )
        .filter(
            reservation_applications_table.c.application_id == box_app_id,
            Reservation.user_email == user_login,
        )
        .order_by(Reservation.end_time.desc())
        .first()
    )

    if latest_reservation and latest_reservation.status == ReservationStatus.COMPLETED:
        # Scenario 1: All past reservations, latest is COMPLETED
        return (
            "DELETE",
            f"Latest Box reservation (ID: {latest_reservation.id}) is COMPLETED "
            f"and no future reservations booked",
        )

    if latest_reservation and latest_reservation.status == ReservationStatus.CANCELLED:
        return (
            "DELETE",
            f"Latest Box reservation (ID: {latest_reservation.id}) is CANCELLED "
            f"and no future reservations booked",
        )

    # Fallback: keep the user if status is uncertain
    return (
        "KEEP",
        f"Latest Box reservation (ID: {latest_reservation.id}) "
        f"has status: {latest_reservation.status.value}",
    )


def run_deprovisioning_job():
    """
    Main entry point for the Box user deprovisioning job.

    1. Lists Box enterprise users filtered to @demospace.altostrat.com
    2. Queries the reservation DB for upcoming Box reservations
    3. Deletes eligible users (or logs in dry-run mode)
    4. Sends a summary notification email
    """
    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    mode_label = "DRY RUN" if dry_run else "LIVE"

    logger.info(f"=== Box User Deprovisioning Job Started ({mode_label}) ===")
    logger.info(f"Reservation look-ahead window: {RESERVATION_LOOKAHEAD_HOURS} hours")

    now = datetime.now(timezone.utc)
    logger.info(f"Current UTC time: {now.isoformat()}")

    # Initialize Box client
    try:
        box_client = setup_box_client()
    except Exception as e:
        logger.error(f"Failed to initialize Box client: {e}")
        sys.exit(1)

    # List Box enterprise users
    try:
        box_users = list_box_enterprise_users(
            box_client, user_domain_filter=DEMOSPACE_USER_DOMAIN
        )
    except Exception as e:
        logger.error(f"Failed to list Box enterprise users: {e}")
        sys.exit(1)

    if not box_users:
        logger.info("No Box users found with the target domain. Exiting.")
        return

    total_scanned = len(box_users)
    logger.info(f"Total Box users to evaluate: {total_scanned}")

    # Query the reservation database
    users_deleted = []
    users_kept = []
    errors = []

    with SessionLocal() as db:
        try:
            box_app_id = get_box_application_id(db)
        except ValueError as e:
            logger.error(str(e))
            sys.exit(1)

        # Get the set of user emails that are protected (have upcoming reservations)
        protected_emails = get_protected_user_emails(db, box_app_id, now)

        # Evaluate each Box user
        for box_user in box_users:
            user_login = box_user["login"]
            user_id = box_user["id"]
            user_name = box_user["name"]

            action, reason = classify_user(
                user_login, protected_emails, db, box_app_id
            )

            if action == "KEEP":
                logger.info(
                    f"KEEP: {user_login} (Box ID: {user_id}) — {reason}"
                )
                users_kept.append({"login": user_login, "reason": reason})
            else:
                # DELETE
                if dry_run:
                    logger.info(
                        f"[DRY RUN] WOULD DELETE: {user_login} "
                        f"(Box ID: {user_id}, Name: {user_name}) — {reason}"
                    )
                    users_deleted.append(
                        {"login": user_login, "reason": reason}
                    )
                else:
                    logger.info(
                        f"DELETING: {user_login} "
                        f"(Box ID: {user_id}, Name: {user_name}) — {reason}"
                    )
                    success = delete_box_user(box_client, user_id)
                    if success:
                        users_deleted.append(
                            {"login": user_login, "reason": reason}
                        )
                    else:
                        errors.append(
                            {
                                "login": user_login,
                                "error": f"Box API deletion failed for user ID {user_id}",
                            }
                        )

    # Log summary
    logger.info("=== Deprovisioning Summary ===")
    logger.info(f"Mode: {mode_label}")
    logger.info(f"Total scanned: {total_scanned}")
    logger.info(f"Users {'would be deleted' if dry_run else 'deleted'}: {len(users_deleted)}")
    logger.info(f"Users kept: {len(users_kept)}")
    logger.info(f"Errors: {len(errors)}")

    # Send notification email
    try:
        send_deprovisioning_summary_email(
            dry_run=dry_run,
            total_scanned=total_scanned,
            users_deleted=users_deleted,
            users_kept=users_kept,
            errors=errors,
        )
    except Exception as e:
        logger.error(f"Failed to send summary email: {e}")

    logger.info("=== Box User Deprovisioning Job Completed ===")

    # Exit with error code if there were failures
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    run_deprovisioning_job()
