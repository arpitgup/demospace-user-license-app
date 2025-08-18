from datetime import datetime, timezone
from sqlalchemy.orm import Session, selectinload, Query, joinedload
from shared_lib.db.models import (
    Application,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
)
from typing import List

from ..common.schemas import (
    BotsUpsertRequest,
)


def get_bot_with_supported_apps(db: Session) -> Query:
    """
    Query to fetch bots with supported applications.
    """
    return db.query(Bot).options(selectinload(Bot.applications))


def upsert_bots_with_applications(request: BotsUpsertRequest, db: Session) -> list[Bot]:
    """
    Updates existing bots or creates new ones based on their email.
    Replaces their supported applications with the provided list.
    """
    processed_bots = []

    all_required_app_ids = {
        app_id for bot_data in request.bots for app_id in bot_data.application_ids
    }

    apps_in_db = (
        db.query(Application).filter(Application.id.in_(all_required_app_ids)).all()
    )

    if len(apps_in_db) != len(all_required_app_ids):
        found_ids = {app.id for app in apps_in_db}
        missing_ids = all_required_app_ids - found_ids
        raise ValueError(f"Applications with these IDs do not exist: {missing_ids}")

    for bot_data in request.bots:
        existing_bot = db.query(Bot).filter(Bot.email == bot_data.email).one_or_none()

        if existing_bot:
            existing_bot.name = bot_data.name

            db.query(BotApplication).filter(
                BotApplication.bot_id == existing_bot.id
            ).delete()

            for app_id in bot_data.application_ids:
                db.add(BotApplication(bot_id=existing_bot.id, application_id=app_id))

            existing_bot.updated_at = datetime.now(timezone.utc)
            processed_bots.append(existing_bot)
        else:
            new_bot = Bot(name=bot_data.name, email=bot_data.email)
            db.add(new_bot)
            db.flush()  # Flush the session to assign an ID to new_bot

            for app_id in bot_data.application_ids:
                db.add(BotApplication(bot_id=new_bot.id, application_id=app_id))

            processed_bots.append(new_bot)

    return processed_bots


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
