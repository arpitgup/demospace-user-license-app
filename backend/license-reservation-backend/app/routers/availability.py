from fastapi import APIRouter, HTTPException, Depends, status
from datetime import timedelta
from sqlalchemy.orm import Session, joinedload
from shared_lib.db.models import (
    Application,
    Bot,
    BotApplication,
    Reservation,
    ApplicationDowntime,
    DowntimeStatus,
    ReservationStatus,
)
from shared_lib.dependencies import get_db, get_app_config, get_user_email
from typing import Optional

from ..utils.crud import is_user_in_cool_off, is_user_in_cool_off_v2

from ..common.constants import (
    ROLLING_WINDOW_HOURS,
    RESERVATION_LEAD_DAYS,
    MAX_SLOTS_TO_FIND,
    RESERVATION_COOL_OFF_HOURS,
)
from ..common.schemas import (
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
    all_apps = db.query(Application).filter(Application.is_active == True).all()
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
    req: AvailabilityByDateRequest,
    demoID: Optional[str] = None,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config),
):
    """
    For a given time range, find all bots that have at least one available application.
    The response contains these bots, along with the applications they can serve in that timeframe.
    """
    if is_user_in_cool_off_v2(
        user_email, req.start_time, app_config[RESERVATION_COOL_OFF_HOURS], demoID, db
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You can only make a new reservation {app_config[RESERVATION_COOL_OFF_HOURS]} hours after your previous reservation ends.",
        )
    all_bots = (
        db.query(Bot)
        .options(
            joinedload(Bot.supported_applications).joinedload(
                BotApplication.application
            )
        )
        .filter(Bot.is_admin == False)
        .all()
    )

    # CHECK: Find all applications with scheduled downtime in the requested time range
    downtime_apps = db.query(ApplicationDowntime).filter(
        ApplicationDowntime.status.in_([DowntimeStatus.PENDING, DowntimeStatus.ACTIVE]),
        ApplicationDowntime.downtime_start < req.end_time,
        ApplicationDowntime.downtime_end > req.start_time,
    ).all()
        
    unavailable_app_ids = {dt.application_id for dt in downtime_apps}

    response_bots = []

    for bot in all_bots:
        # Check which applications are actually available for this bot in the time slot
        available_apps = get_bot_availability_in_slot(
            bot, req.start_time, req.end_time, db
        )

        # Filter out applications that have scheduled downtime
        updated_available_apps = [
            app for app in available_apps if app.id not in unavailable_app_ids
        ]

        if updated_available_apps:
            response_bots.append(
                AvailableBotInfo(
                    id=bot.id,
                    name=bot.name,
                    email=bot.email,
                    applications=updated_available_apps,
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
    user_email: str = Depends(get_user_email),
):
    """
    Finds available bots and the applications they can serve for a given application and time.
    Handles partial bot availability. If the requested time is unavailable, it finds the next N available slots.
    """
    # Check if the requested application is active
    application = (
        db.query(Application).filter(Application.id == req.application_id).one_or_none()
    )
    if not application or not application.is_active:
        raise HTTPException(
            status_code=404,
            detail=f"Application with ID {req.application_id} not found or is not active.",
        )

    req_end_time = req.start_time + timedelta(hours=req.duration_hours)

    # Cool-off check for requested slot
    if is_user_in_cool_off(
        user_email,
        req.start_time,
        app_config[RESERVATION_COOL_OFF_HOURS],
        db,
    ):
        return AvailabilityByApplicationResponse(
            requested_slot_available=False,
            is_downtime_conflict=False,
            next_available_slots=[],
        )

    # Check for scheduled downtime for the requested application
    downtime_conflict = (
        db.query(ApplicationDowntime)
        .filter(
            ApplicationDowntime.application_id == req.application_id,
            ApplicationDowntime.status.in_(
                [DowntimeStatus.PENDING, DowntimeStatus.ACTIVE]
            ),
            ApplicationDowntime.downtime_start < req_end_time,
            ApplicationDowntime.downtime_end > req.start_time,
        )
        .first()
    )
    
    # Early return if a downtime conflict exists and user doesn't want next slots
    if downtime_conflict and not req.get_next_slots:
        return AvailabilityByApplicationResponse(
            requested_slot_available=False,
            is_downtime_conflict=True,
            next_available_slots=[],
        )

    # Check for bot and reservation availability
    available_bots_in_req_slot = []
    
    # We only check for bot/reservation availability if there is NO downtime conflict
    if not downtime_conflict:
        supporting_bots = (
            db.query(Bot)
            .join(BotApplication)
            .filter(BotApplication.application_id == req.application_id)
            .filter(Bot.is_admin == False)
            .all()
        )

        if not supporting_bots:
            raise HTTPException(
                status_code=404,
                detail=f"No bots found that support application ID {req.application_id}",
            )
            
        for bot in supporting_bots:
            available_apps = get_bot_availability_in_slot(
                bot, req.start_time, req_end_time, db
            )
            if any(app.id == req.application_id for app in available_apps):
                available_bots_in_req_slot.append(
                    AvailableBotInfo(
                        id=bot.id,
                        name=bot.name,
                        email=bot.email,
                        applications=available_apps,
                    )
                )

    # If bots are available (and there was no downtime conflict), return the requested slot
    if available_bots_in_req_slot:
        return AvailabilityByApplicationResponse(
            requested_slot_available=True,
            is_downtime_conflict=False,
            next_available_slots=[
                AvailabilitySlot(
                    start_time=req.start_time,
                    end_time=req_end_time,
                    available_bots=available_bots_in_req_slot,
                )
            ],
        )

    # If the requested slot is unavailable and we should look for next slots
    # This applies if the slot was unavailable due to a reservation conflict or a downtime conflict.
    if not req.get_next_slots:
        # If no bots were found and get_next_slots is false, handle the empty list case
        return AvailabilityByApplicationResponse(
            requested_slot_available=False,
            is_downtime_conflict=bool(downtime_conflict),
            next_available_slots=[],
        )


    # Find the next N available slots
    next_slots = []
    rolling_window_hours = app_config[ROLLING_WINDOW_HOURS]
    reservation_lead_days = app_config[RESERVATION_LEAD_DAYS]
    max_slots = app_config[MAX_SLOTS_TO_FIND]

    search_start_time = req_end_time + timedelta(hours=rolling_window_hours)
    max_end_time = req.start_time + timedelta(days=reservation_lead_days)
    
    # The supporting_bots query is needed here too, so we'll run it once.
    supporting_bots = (
        db.query(Bot)
        .join(BotApplication)
        .filter(BotApplication.application_id == req.application_id)
        .filter(Bot.is_admin == False)
        .all()
    )
    if not supporting_bots:
        # No bots support the application at all, so no future slots can be found.
        return AvailabilityByApplicationResponse(
            requested_slot_available=False,
            is_downtime_conflict=bool(downtime_conflict),
            next_available_slots=[],
        )

    while len(next_slots) < max_slots and search_start_time < max_end_time:
        potential_start = search_start_time
        potential_end = potential_start + timedelta(hours=req.duration_hours)

        if potential_end > max_end_time:
            break

        if is_user_in_cool_off(
            user_email,
            potential_start,
            app_config[RESERVATION_COOL_OFF_HOURS],
            db,
        ):
            search_start_time += timedelta(hours=rolling_window_hours)
            continue

        downtime_conflict_next = (
            db.query(ApplicationDowntime)
            .filter(
                ApplicationDowntime.application_id == req.application_id,
                ApplicationDowntime.status.in_([DowntimeStatus.PENDING, DowntimeStatus.ACTIVE]),
                ApplicationDowntime.downtime_start < potential_end,
                ApplicationDowntime.downtime_end > potential_start,
            )
            .first()
        )
        
        if downtime_conflict_next:
            search_start_time += timedelta(hours=rolling_window_hours)
            continue

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
        requested_slot_available=False, 
        is_downtime_conflict=bool(downtime_conflict),
        next_available_slots=next_slots
    )