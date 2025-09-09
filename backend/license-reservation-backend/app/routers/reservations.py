from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from loguru import logger
from shared_lib.dependencies import get_user_email, get_user_current_time, get_db, get_app_config
from typing import List
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from shared_lib.db.models import (
    Application,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus
)
from datetime import timezone

from ..common.constants import RESERVATION_COOL_OFF_HOURS, RESERVATION_EMAIL_SENDER, BOOKED_RESERVATION_EMAIL_CONTENT, CANCELLED_RESERVATION_EMAIL_CONTENT, MIN_LEAD_COOLDOWN_HOURS, MAX_RESERVATION_LEAD_DAYS
from ..common.schemas import (
    CreateReservationRequest,
    ReservationOut,
)
from ..utils.background_tasks import (
    schedule_reservation_tasks,
    delete_reservation_tasks,
    sendReservationEmail    
)
from ..utils.crud import is_user_in_cool_off, is_valid_reservation_lead_time


router = APIRouter()


@router.get("/reservations", response_model=List[ReservationOut])
def get_user_reservations(
    db: Session = Depends(get_db), user_email: str = Depends(get_user_email)
):
    """
    Retrieves all reservations made by a specific user.
    """
    reservations = (
        db.query(Reservation).filter(Reservation.user_email == user_email).all()
    )
    return reservations


@router.post(
    "/reservations",
    response_model=ReservationOut,
    status_code=status.HTTP_201_CREATED,
)
def make_reservation(
    req: CreateReservationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config),
):
    """
    Creates a single reservation if a single bot can serve all requested applications
    for the specified time range.
    """
    if is_user_in_cool_off(
        user_email, req.start_time, app_config[RESERVATION_COOL_OFF_HOURS], db
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You can only make a new reservation {app_config[RESERVATION_COOL_OFF_HOURS]} hours after your previous reservation ends.",
        )    
    error_detail = is_valid_reservation_lead_time(
        req.start_time, app_config[MIN_LEAD_COOLDOWN_HOURS], app_config[MAX_RESERVATION_LEAD_DAYS]
    )    
    if error_detail:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail=error_detail
        )
    all_app_ids = [req.primary_application_id] + req.secondary_application_ids
    unique_app_ids = list(set(all_app_ids))

    # Check if all requested applications exist
    apps_in_db = db.query(Application).filter(Application.id.in_(unique_app_ids)).all()
    if len(apps_in_db) != len(unique_app_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more requested application IDs do not exist.",
        )

    # Find a bot that supports ALL requested applications
    candidate_bots_query = (
        db.query(Bot)
        .join(Bot.supported_applications)
        .filter(BotApplication.application_id.in_(unique_app_ids))
        .group_by(Bot.id)
        .having(func.count(BotApplication.application_id) == len(unique_app_ids))
    )
    candidate_bots = candidate_bots_query.all()
    if not candidate_bots:
        raise HTTPException(
            status_code=404,
            detail="No single bot found that supports all requested applications.",
        )

    # Check availability for the found bots
    suitable_bot = None
    for bot in candidate_bots:
        # Check if this bot has an overlapping reservation that includes ANY of the requested apps
        conflict = (
            db.query(Reservation)
            .join(Reservation.applications)
            .filter(
                Reservation.bot_id == bot.id,
                Application.id.in_(unique_app_ids),
                Reservation.status.in_(
                    [ReservationStatus.PENDING, ReservationStatus.ACTIVE]
                ),
                Reservation.start_time < req.end_time,
                Reservation.end_time > req.start_time,
            )
            .first()
        )

        if not conflict:
            suitable_bot = bot
            break

    if not suitable_bot:
        raise HTTPException(
            status_code=409,
            detail="Found bots that support all applications, but none are available for the requested time.",
        )

    new_reservation = Reservation(
        user_email=user_email,
        bot_id=suitable_bot.id,
        primary_application_id=req.primary_application_id,
        start_time=req.start_time,
        end_time=req.end_time,
        status=ReservationStatus.PENDING,
    )
    new_reservation.applications.extend(apps_in_db)

    try:
        db.add(new_reservation)
        db.commit()
        db.refresh(new_reservation)
        logger.info(
            f"Successfully created reservation {new_reservation.id} for user {user_email} with bot {suitable_bot.name}"
        )
        background_tasks.add_task(
            schedule_reservation_tasks,
            new_reservation.id,
            new_reservation.start_time.replace(tzinfo=timezone.utc),
            new_reservation.end_time.replace(tzinfo=timezone.utc),
        )
        background_tasks.add_task(
            sendReservationEmail,
            recipient_email=user_email,
            sender_email=app_config[RESERVATION_EMAIL_SENDER],            
            reservation_id=new_reservation.id,
            subject="Your Agentspace SaaS License Reservation Confirmation",
            email_content=format_email_for_reservation(BOOKED_RESERVATION_EMAIL_CONTENT, new_reservation)
        )

    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Could not create reservation due to a database error.",
        )

    except Exception as e:
        db.rollback()
        logger.error(
            f"An unexpected error occurred while creating the reservation for user {user_email}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while creating the reservation.",
        )

    return new_reservation

@router.post(
    "/reservations/{reservation_id}/cancel",
    response_model=ReservationOut,    
)
def cancel_reservation(
    reservation_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
):
    """
    Cancels a specific reservation by its ID.
    """
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )
    if user_email != reservation.user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You cannot cancel a reservation made by others.",
        )
    if reservation.status in [ReservationStatus.CANCELLED, ReservationStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Reservation is already in '{reservation.status.value}' state and cannot be cancelled.",
        )
    reservation.status = ReservationStatus.CANCELLED
    db.commit()
    db.refresh(reservation)
    logger.info(
        f"Cancelling reservation {reservation.id}. Associated provisioning/deprovisioning tasks will be deleted."
    )
    background_tasks.add_task(delete_reservation_tasks, reservation.id)
    background_tasks.add_task(
        sendReservationEmail,
        recipient_email=user_email,
        sender_email=app_config[RESERVATION_EMAIL_SENDER],
        reservation_id=reservation_id,
        subject="Your Agentspace SaaS License Cancellation Confirmation",
        email_content=format_email_for_reservation(CANCELLED_RESERVATION_EMAIL_CONTENT, reservation)
        )
    return reservation

def format_email_for_reservation(emailContent, reservationDetails):
    """
    Replaces placeholders in the email template with reservation details.
    """
    start_time_str = reservationDetails.start_time.strftime("%B %d, %Y at %I:%M %p %Z")
    end_time_str = reservationDetails.end_time.strftime("%B %d, %Y at %I:%M %p %Z")
    
    dynamic_details_html = ""
    app_names = " - ".join([app.name for app in reservationDetails.applications])
    dynamic_details_html += f"""
    <p style="margin: 0 0 5px 0; font-size: 16px;"><strong>{app_names}</strong></p>
    <p style="margin: 0 0 5px 0; padding-left: 20px;">&bull; Starting: {start_time_str}</p>
    <p style="margin: 0 0 15px 0; padding-left: 20px;">&bull; Ending: {end_time_str}</p>
    """
    formatted_content = emailContent.replace(
        "{{ dynamic_reservation_details }}", dynamic_details_html
    )    
    
    return formatted_content