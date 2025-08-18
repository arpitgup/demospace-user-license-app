from datetime import timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from loguru import logger
from sqlalchemy.orm import Session
from shared_lib.db.models import (
    Application,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
)
from shared_lib.dependencies import get_user_email, get_db
from typing import List

from ..common.schemas import (
    BulkCancelReservationsRequest,
    BulkCancelReservationsResponse,
    ExtendReservationRequest,
    ReservationOut,
    BotWithApplicationsOut,
    UpdateBotApplicationsRequest,
    UpdateApplicationStatusRequest,
    BotsUpsertRequest,
)
from ..utils.background_tasks import (
    delete_reservation_tasks,
    schedule_deprovisioning_task,
    delete_license_deprovisioning_task,
)
from ..utils.crud import get_bot_with_supported_apps, upsert_bots_with_applications


router = APIRouter()


def build_response(bots: List[Bot]) -> List[BotWithApplicationsOut]:
    """
    Helper function to convert a list of Bot models to BotWithApplicationsOut objects.
    """
    res = []
    for bot in bots:
        res.append(
            BotWithApplicationsOut(
                id=bot.id,
                name=bot.email,
                email=bot.email,
                created_at=bot.created_at,
                updated_at=bot.updated_at,
                supported_applications=[
                    ba.application for ba in bot.supported_applications
                ],
            )
        )
    return res


@router.get("/admin/reservations", response_model=List[ReservationOut])
def get_all_reservations(
    db: Session = Depends(get_db), user_email: str = Depends(get_user_email)
):
    """
    Retrieves all reservations.
    """
    # TODO: check for admin user
    logger.info(f"Admin User {user_email}: Fetching all reservations")
    reservations = db.query(Reservation).all()
    return reservations


@router.post(
    "/admin/reservations/bulk-cancel",
    response_model=BulkCancelReservationsResponse,
)
def bulk_cancel_reservations(
    req: BulkCancelReservationsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Cancels a list of reservations by their IDs.
    """
    # TODO: check for admin user
    logger.info(
        f"Admin User {user_email}: Bulk cancelling reservations: {req.reservation_ids}"
    )
    failed_to_cancel = []
    cancel_immediately = set()
    schedule_cancellation = set()

    reservations = (
        db.query(Reservation).filter(Reservation.id.in_(req.reservation_ids)).all()
    )
    reservation_map = {res.id: res for res in reservations}

    for res_id in req.reservation_ids:
        reservation = reservation_map.get(res_id)
        if not reservation or reservation.status in [
            ReservationStatus.CANCELLED,
            ReservationStatus.COMPLETED,
        ]:
            failed_to_cancel.append(res_id)
            continue

        reservation.status = ReservationStatus.CANCELLED

        if reservation.status == ReservationStatus.ACTIVE:
            cancel_immediately.add(res_id)
        else:
            schedule_cancellation.add(res_id)

    try:
        db.commit()
        for reservation_id in schedule_cancellation:
            background_tasks.add_task(delete_reservation_tasks, reservation_id)
        for reservation_id in cancel_immediately:
            background_tasks.add_task(schedule_deprovisioning_task, reservation_id)
    except Exception as e:
        db.rollback()
        logger.error(f"An unexpected error occurred during bulk cancel: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during bulk cancellation.",
        )

    return BulkCancelReservationsResponse(
        successfully_cancelled=list(cancel_immediately | schedule_cancellation),
        failed_to_cancel=failed_to_cancel,
    )


@router.patch(
    "/admin/reservations/{reservation_id}/extend", response_model=ReservationOut
)
def extend_reservation(
    reservation_id: int,
    req: ExtendReservationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Extends an active reservation to a new end time.
    """
    logger.info(
        f"Admin User {user_email}: Extending reservation {reservation_id} to {req.end_time}"
    )

    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()

    if not reservation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Only active reservations can be extended.",
        )

    reservation_end_time = reservation.end_time
    if reservation_end_time.tzinfo is None:
        reservation_end_time = reservation_end_time.replace(tzinfo=timezone.utc)
    if req.end_time <= reservation_end_time:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="New end time must be after the current end time.",
        )

    # Check for bot availability
    conflicting_reservations = (
        db.query(Reservation)
        .filter(
            Reservation.bot_id == reservation.bot_id,
            Reservation.id != reservation_id,
            Reservation.status.in_(
                [ReservationStatus.ACTIVE, ReservationStatus.PENDING]
            ),
            Reservation.start_time < req.end_time,
            Reservation.end_time > reservation_end_time,
        )
        .all()
    )

    if conflicting_reservations:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Bot is not available for the extended period.",
        )

    reservation.end_time = req.end_time
    try:
        db.commit()
        db.refresh(reservation)
        background_tasks.add_task(
            delete_license_deprovisioning_task,
            reservation.id,
            reservation.deprovisioning_task_id,
        )
        background_tasks.add_task(
            schedule_deprovisioning_task, reservation.id, reservation.end_time
        )
    except Exception as e:
        db.rollback()
        logger.error(f"An unexpected error occurred during reservation extension: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during reservation extension.",
        )

    return reservation


@router.patch(
    "/admin/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT
)
def update_application_status(
    application_id: int,
    req: UpdateApplicationStatusRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Activates or deactivates an application.
    """
    logger.info(
        f"Admin User {user_email}: Updating application {application_id} status to {req.is_active}"
    )

    application = db.query(Application).filter(Application.id == application_id).first()

    if not application:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.is_active = req.is_active
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(
            f"An unexpected error occurred during application status update: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during application status update.",
        )


# TODO: Add test
@router.get("/admin/bots", response_model=List[BotWithApplicationsOut])
def get_all_bots(db: Session = Depends(get_db)):
    """
    Retrieves all bots and the applications they support.
    """
    return get_bot_with_supported_apps(db).all()


# TODO: Add test
@router.patch(
    "/admin/bots/{bot_id}/applications", response_model=BotWithApplicationsOut
)
def update_bot_applications(
    bot_id: int,
    req: UpdateBotApplicationsRequest,
    db: Session = Depends(get_db),
):
    """
    Updates the applications a specific bot supports.
    """
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Bot not found")

    valid_apps = (
        db.query(Application).filter(Application.id.in_(req.application_ids)).all()
    )
    if len(valid_apps) != len(req.application_ids):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="One or more application IDs are invalid",
        )

    db.query(BotApplication).filter(BotApplication.bot_id == bot_id).delete()
    for app_id in req.application_ids:
        db.add(BotApplication(bot_id=bot_id, application_id=app_id))
    db.commit()
    db.refresh(bot)

    bot = get_bot_with_supported_apps(db).filter(Bot.id == bot_id).one()
    return build_response([bot])[0]


# TODO: Add test
@router.post(
    "/bots/upsert", response_model=list[BotWithApplicationsOut], status_code=200
)
def upsert_bots(request: BotsUpsertRequest, db: Session = Depends(get_db)):
    """
    Updates existing bots or creates new ones in a batch.

    - If a bot with the provided email exists, its name and supported applications are updated.
    - If it does not exist, a new bot is created.
    """
    try:
        processed_bots = upsert_bots_with_applications(request, db)
        db.commit()

        for bot in processed_bots:
            db.refresh(bot)

        return processed_bots
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail="An internal server error occurred."
        )
