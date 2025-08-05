from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session, joinedload

from ..common.constants import ROLLING_WINDOW_HOURS, MAX_LEAD_DAYS, MAX_SLOTS_TO_FIND
from ..common.models import (
    Application,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
)
from ..common.schemas import (
    ApplicationOut,
    AvailableBotInfo,
    AvailabilitySlot,
    AvailabilityByApplicationRequest,
    AvailabilityByApplicationResponse,
    AvailabilityByDateRequest,
    AvailabilityByDateResponse,
    AvailabilitySlot,
)
from ..utils.dependencies import get_user_email, get_db


router = APIRouter()


@router.post("/availability/by-date", response_model=AvailabilityByDateResponse)
def get_availability_by_date(
    req: AvailabilityByDateRequest, db: Session = Depends(get_db)
):
    """
    For a given time range, find all applications that can be served.
    An application is considered available if at least one bot supporting it is free.
    """
    all_apps = db.query(Application).all()
    available_apps = []

    # For each application, check if at least one bot is available
    for app in all_apps:
        # Find bots supporting this app
        supporting_bots = (
            db.query(Bot)
            .join(BotApplication)
            .filter(BotApplication.application_id == app.id)
            .all()
        )
        if not supporting_bots:
            continue

        # Check if any of these bots is free in the given time range
        is_app_available = False
        for bot in supporting_bots:
            # Check for conflicting reservations for this bot and app
            conflict = (
                db.query(Reservation)
                .join(Reservation.applications)
                .filter(
                    Reservation.bot_id == bot.id,
                    Application.id == app.id,
                    Reservation.status.in_(
                        [ReservationStatus.PENDING, ReservationStatus.ACTIVE]
                    ),
                    Reservation.start_time < req.end_time,
                    Reservation.end_time > req.start_time,
                )
                .first()
            )

            if not conflict:
                # Found a free bot for this app in the time range
                is_app_available = True
                break

        if is_app_available:
            available_apps.append(ApplicationOut(id=app.id, name=app.name))

    return AvailabilityByDateResponse(applications=available_apps)


def get_bot_availability_in_slot(
    bot: Bot, start_time: datetime, end_time: datetime, db: Session
) -> List[Application]:
    """
    Calculates which applications a specific bot can serve during a given time slot.
    """
    # Get all applications this bot supports. The relationship is now eagerly loaded.
    all_supported_apps = [ba.application for ba in bot.supported_applications]
    all_supported_app_ids = {app.id for app in all_supported_apps}

    # Find applications this bot is busy with during the slot
    conflicting_reservations = (
        db.query(Reservation)
        .filter(
            Reservation.bot_id == bot.id,
            Reservation.status.in_(
                [ReservationStatus.PENDING, ReservationStatus.ACTIVE]
            ),
            Reservation.start_time < end_time,
            Reservation.end_time > start_time,
        )
        .options(joinedload(Reservation.applications))
        .all()
    )

    busy_app_ids = set()
    for res in conflicting_reservations:
        for app in res.applications:
            busy_app_ids.add(app.id)

    # Determine available applications
    available_app_ids = all_supported_app_ids - busy_app_ids
    available_apps = [app for app in all_supported_apps if app.id in available_app_ids]

    return available_apps


@router.post(
    "/availability/by-application",
    response_model=AvailabilityByApplicationResponse,
)
def get_availability_by_application(
    req: AvailabilityByApplicationRequest, db: Session = Depends(get_db)
):
    """
    Finds available bots and the applications they can serve for a given application and time.
    Handles partial bot availability. If the requested time is unavailable, it finds the next N available slots.
    """
    # Find all bots that support the requested application
    supporting_bots = (
        db.query(Bot)
        .join(BotApplication)
        .filter(BotApplication.application_id == req.application_id)
        .all()
    )

    if not supporting_bots:
        raise HTTPException(
            status_code=404,
            detail=f"No bots found that support application ID {req.application_id}",
        )

    req_end_time = req.start_time + timedelta(hours=req.duration_hours)

    # Check availability for the requested time slot
    available_bots_in_req_slot = []
    for bot in supporting_bots:
        available_apps = get_bot_availability_in_slot(
            bot, req.start_time, req_end_time, db
        )
        # Check if the bot is available for the *specifically requested* application
        if any(app.id == req.application_id for app in available_apps):
            available_bots_in_req_slot.append(
                AvailableBotInfo(
                    id=bot.id,
                    name=bot.name,
                    email=bot.email,
                    applications=available_apps,
                )
            )

    # If bots are available for the requested slot, return that single slot
    if available_bots_in_req_slot:
        return AvailabilityByApplicationResponse(
            requested_slot_available=True,
            next_available_slots=[
                AvailabilitySlot(
                    start_time=req.start_time,
                    end_time=req_end_time,
                    available_bots=available_bots_in_req_slot,
                )
            ],
        )

    if not req.get_next_slots:
        return AvailabilityByApplicationResponse(
            requested_slot_available=False,
            next_available_slots=[],
        )

    # If no bots are available, find the next N available slots
    # logger.info(f"No bots available for app {req.application_id} at the requested time. Searching for next slots.")
    next_slots = []

    search_start_time = req.start_time + timedelta(hours=ROLLING_WINDOW_HOURS)
    max_end_time = req.start_time + timedelta(days=MAX_LEAD_DAYS)

    while len(next_slots) < MAX_SLOTS_TO_FIND and search_start_time < max_end_time:
        potential_start = search_start_time
        potential_end = potential_start + timedelta(hours=req.duration_hours)

        if potential_end > max_end_time:
            break

        available_bots_in_potential_slot = []
        for bot in supporting_bots:
            available_apps = get_bot_availability_in_slot(
                bot, potential_start, potential_end, db
            )
            if any(app.id == req.application_id for app in available_apps):
                available_bots_in_potential_slot.append(
                    AvailableBotInfo(
                        id=bot.id,
                        name=bot.name,
                        email=bot.email,
                        applications=available_apps,
                    )
                )

        if available_bots_in_potential_slot:
            next_slots.append(
                AvailabilitySlot(
                    start_time=potential_start,
                    end_time=potential_end,
                    available_bots=available_bots_in_potential_slot,
                )
            )

        search_start_time += timedelta(hours=ROLLING_WINDOW_HOURS)

    return AvailabilityByApplicationResponse(
        requested_slot_available=False, next_available_slots=next_slots
    )
