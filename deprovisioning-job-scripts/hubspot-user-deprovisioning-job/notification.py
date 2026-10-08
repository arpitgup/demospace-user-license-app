"""
Email notification module for the HubSpot user deprovisioning job.

Sends a summary HTML report to the admin group after each job run.
"""

import base64
import os
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import List

from googleapiclient.errors import HttpError
from loguru import logger
from shared_lib.email_service import get_email_service


# --- Email Constants ---
NOTIFICATION_SENDER_EMAIL = "no-reply@1987984870407.altostrat.com"
PORTAL_ADMIN_GROUP_EMAIL = "arpitgup@google.com, tasbirimam@google.com, simandi@google.com, jagtars@google.com, sukruthananth@google.com"

def send_deprovisioning_summary_email(
    dry_run: bool,
    total_scanned: int,
    users_deleted: List[dict],
    users_kept: List[dict],
    errors: List[dict],
    admin_email: str = PORTAL_ADMIN_GROUP_EMAIL,
    sender_email: str = NOTIFICATION_SENDER_EMAIL,
):
    """
    Send a summary email to the admin group after a deprovisioning job run.

    Args:
        dry_run: Whether the job ran in dry-run mode.
        total_scanned: Total number of HubSpot users scanned.
        users_deleted: List of dicts with 'login' and 'reason' for deleted users.
        users_kept: List of dicts with 'login' and 'reason' for kept users.
        errors: List of dicts with 'login' and 'error' for failed deletions.
        admin_email: Recipient admin group email.
        sender_email: Sender email address.
    """
    if not admin_email:
        logger.warning(
            "No admin email configured. Skipping notification email."
        )
        return

    run_timestamp = datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")
    mode_label = "DRY RUN" if dry_run else "LIVE"
    action_verb = "would be deleted" if dry_run else "deleted"

    # Build the deleted users table rows
    deleted_rows = ""
    for user in users_deleted:
        deleted_rows += f"""
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">{user['login']}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">{user['reason']}</td>
        </tr>
        """

    # Build the kept users table rows
    kept_rows = ""
    for user in users_kept:
        kept_rows += f"""
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">{user['login']}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">{user['reason']}</td>
        </tr>
        """

    # Build the error rows
    error_rows = ""
    for err in errors:
        error_rows += f"""
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0;">{err['login']}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; color: #d93025;">{err['error']}</td>
        </tr>
        """

    errors_section = ""
    if errors:
        errors_section = f"""
        <h3 style="color: #d93025; margin-top: 20px;">⚠️ Errors ({len(errors)})</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
                <tr style="background-color: #fce8e6;">
                    <th style="padding: 8px 12px; text-align: left;">User</th>
                    <th style="padding: 8px 12px; text-align: left;">Error</th>
                </tr>
            </thead>
            <tbody>
                {error_rows}
            </tbody>
        </table>
        """

    email_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HubSpot User Deprovisioning Report</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="700"
               style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
                <td style="padding: 20px 30px; border-bottom: 1px solid #eeeeee; border-top-left-radius: 12px; border-top-right-radius: 12px;">
                    <div style="display: flex; align-items: center;">
                        <img src="https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png"
                             alt="Cloud icon" style="height: 30px; margin-right: 12px;">
                        <span style="font-size: 22px; font-weight: bold; color: #202124;">
                            HubSpot User Deprovisioning Report
                        </span>
                    </div>
                    <div style="margin-top: 8px; font-size: 14px; color: #5f6368;">
                        {run_timestamp} &nbsp;|&nbsp;
                        <span style="padding: 2px 8px; border-radius: 4px;
                                     background-color: {'#fce8e6' if not dry_run else '#e8f0fe'};
                                     color: {'#d93025' if not dry_run else '#1967d2'}; font-weight: bold;">
                            {mode_label}
                        </span>
                    </div>
                </td>
            </tr>

            <!-- Summary Stats -->
            <tr>
                <td style="padding: 20px 30px;">
                    <table style="width: 100%; text-align: center;">
                        <tr>
                            <td style="padding: 10px;">
                                <div style="font-size: 32px; font-weight: bold; color: #202124;">{total_scanned}</div>
                                <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Users Scanned</div>
                            </td>
                            <td style="padding: 10px;">
                                <div style="font-size: 32px; font-weight: bold; color: #d93025;">{len(users_deleted)}</div>
                                <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Users {action_verb.title()}</div>
                            </td>
                            <td style="padding: 10px;">
                                <div style="font-size: 32px; font-weight: bold; color: #188038;">{len(users_kept)}</div>
                                <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Users Kept</div>
                            </td>
                            <td style="padding: 10px;">
                                <div style="font-size: 32px; font-weight: bold; color: #e37400;">{len(errors)}</div>
                                <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Errors</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- Deleted Users -->
            <tr>
                <td style="padding: 0 30px 20px 30px;">
                    <h3 style="color: #d93025; margin-bottom: 10px;">
                        🗑️ Users {action_verb.title()} ({len(users_deleted)})
                    </h3>
                    {f\'\'\'
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background-color: #fce8e6;">
                                <th style="padding: 8px 12px; text-align: left;">User</th>
                                <th style="padding: 8px 12px; text-align: left;">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deleted_rows}
                        </tbody>
                    </table>
                    \'\'\' if users_deleted else \'<p style="color: #5f6368; font-size: 14px;">No users were \' + action_verb + \'.</p>\'}
                </td>
            </tr>

            <!-- Kept Users -->
            <tr>
                <td style="padding: 0 30px 20px 30px;">
                    <h3 style="color: #188038; margin-bottom: 10px;">
                        ✅ Users Kept ({len(users_kept)})
                    </h3>
                    {f\'\'\'
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background-color: #e6f4ea;">
                                <th style="padding: 8px 12px; text-align: left;">User</th>
                                <th style="padding: 8px 12px; text-align: left;">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {kept_rows}
                        </tbody>
                    </table>
                    \'\'\' if users_kept else \'<p style="color: #5f6368; font-size: 14px;">No users were kept.</p>\'}
                </td>
            </tr>

            <!-- Errors Section -->
            <tr>
                <td style="padding: 0 30px 20px 30px;">
                    {errors_section}
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="padding: 15px 30px; border-top: 1px solid #eeeeee; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                    <p style="margin: 0; color: #5f6368; font-size: 12px;">
                        This is an automated message from the HubSpot User Deprovisioning Job.
                        Do not reply to this email.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    try:
        email_service = get_email_service()
        message = EmailMessage()
        message.add_alternative(email_content, subtype="html")
        message["To"] = admin_email
        message["From"] = sender_email
        message["Subject"] = f"[{mode_label}] HubSpot User Deprovisioning Report — {run_timestamp}"

        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        create_message = {"raw": encoded_message}

        send_message = (
            email_service.users()
            .messages()
            .send(userId="me", body=create_message)
            .execute()
        )
        logger.info(
            f"Deprovisioning summary email sent to {admin_email}. "
            f"Message ID: {send_message['id']}"
        )
    except HttpError as error:
        logger.error(f"Failed to send deprovisioning summary email: {error}")
    except Exception as e:
        logger.error(f"Unexpected error sending deprovisioning email: {e}")
