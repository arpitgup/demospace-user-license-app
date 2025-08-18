from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session, joinedload
from shared_lib.db.models import (
    Application,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
)
from shared_lib.dependencies import get_db, get_app_config

from ..common.constants import (
    ROLLING_WINDOW_HOURS,
    RESERVATION_LEAD_DAYS,
    MAX_SLOTS_TO_FIND,
)
from ..common.schemas import (
    ApplicationOut,
    AvailableBotInfo,
    AvailabilitySlot,
    AvailabilityByApplicationRequest,
    AvailabilityByApplicationResponse,
    AvailabilityByDateRequest,
    AvailabilityByDateResponse,
    AvailabilityByDateV2Response,
    AvailabilitySlot,
)
from ..utils.crud import get_bot_availability_in_slot


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
            available_apps.append(app)

    return AvailabilityByDateResponse(applications=available_apps)


@router.post("/availability/by-date/v2", response_model=AvailabilityByDateV2Response)
def get_availability_by_date_v2(
    req: AvailabilityByDateRequest, db: Session = Depends(get_db)
):
    """
    For a given time range, find all bots that have at least one available application.
    The response contains these bots, along with the applications they can serve in that timeframe.
    """
    all_bots = (
        db.query(Bot)
        .options(
            joinedload(Bot.supported_applications).joinedload(
                BotApplication.application
            )
        )
        .all()
    )
    response_bots = []

    for bot in all_bots:
        # Check which applications are actually available for this bot in the time slot
        available_apps = get_bot_availability_in_slot(
            bot, req.start_time, req.end_time, db
        )

        if available_apps:
            response_bots.append(
                AvailableBotInfo(
                    id=bot.id,
                    name=bot.name,
                    email=bot.email,
                    applications=available_apps,
                )
            )

    return AvailabilityByDateV2Response(available_bots=response_bots)


@router.post(
    "/availability/by-application",
    response_model=AvailabilityByApplicationResponse,
)
def get_availability_by_application(
    req: AvailabilityByApplicationRequest,
    db: Session = Depends(get_db),
    app_config=Depends(get_app_config),
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
    next_slots = []

    rolling_window_hours = app_config[ROLLING_WINDOW_HOURS]
    reservation_lead_days = app_config[RESERVATION_LEAD_DAYS]
    max_slots = app_config[MAX_SLOTS_TO_FIND]

    search_start_time = req.start_time + timedelta(hours=rolling_window_hours)
    max_end_time = req.start_time + timedelta(days=reservation_lead_days)

    while len(next_slots) < max_slots and search_start_time < max_end_time:
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

        search_start_time += timedelta(hours=rolling_window_hours)

    return AvailabilityByApplicationResponse(
        requested_slot_available=False, next_available_slots=next_slots
    )
