from datetime import timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from loguru import logger
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from shared_lib.db.models import (
    Application,
    ApplicationLicenseType,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
    ApplicationDowntime    
)
from shared_lib.dependencies import get_user_email, get_db
from typing import List
from shared_lib.enums import DowntimeStatus
from shared_lib.admin_service import create_custom_schema
from ..common.constants import ACCOUNT_CUSTOMERID

from ..common.schemas import (
    ApplicationWithLicenseGroupOut,
    BulkCancelReservationsRequest,
    BulkCancelReservationsResponse,
    ExtendReservationRequest,
    ReservationOut,
    BotWithApplicationsOut,
    UpdateApplicationsRequest,
    UpdateBotApplicationsRequest,
    UpdateApplicationStatusRequest,
    BotsCreateRequest,
    BotsUpdateRequest,
    ApplicationDowntimeRequest,
    ApplicationDowntimeOut,
    DowntimeBulkCancelRequest,
    DowntimeBulkCancelResponse,
    ApplicationCreateRequest,
    ApplicationCreateResponse,
    RemoveAppFromReservationsRequest
)
from ..utils.background_tasks import (
    delete_reservation_tasks,
    schedule_deprovisioning_task,
    delete_license_deprovisioning_task,
    schedule_downtime_tasks,
    delete_downtime_tasks
)
from ..utils.crud import get_bot_with_supported_apps, create_bot, update_bot

router = APIRouter(prefix="/admin")

def build_response(bots: List[Bot]) -> List[BotWithApplicationsOut]:
    """
    Helper function to convert a list of Bot models to BotWithApplicationsOut objects .
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
                applications=[ba.application for ba in bot.supported_applications],
            )
        )
    return res


@router.get("/applications", response_model=List[ApplicationWithLicenseGroupOut])
def get_applications(db: Session = Depends(get_db)):
    """
    Retrieves all applications with their total licenses, allocated license & license group.
    """    
    query_result = (
        db.query(Application, func.count(Bot.id).label('license_assigned_to_Bots'))
        .outerjoin(Application.bots)
        .group_by(Application.id)
        .all()
    )

    applications_with_count = []
    for application, count in query_result:
        app_data = application.__dict__
        app_data['license_assigned_to_Bots'] = count
        applications_with_count.append(ApplicationWithLicenseGroupOut.model_validate(app_data))

    return applications_with_count

@router.patch("/applications", status_code=status.HTTP_204_NO_CONTENT)
def update_applications(
    req: UpdateApplicationsRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Updates the status and license group for multiple applications.
    """
    logger.info(f"Admin User {user_email}: Updating applications: {req.applications}")
    app_ids = [app.id for app in req.applications]
    apps_in_db = db.query(Application).filter(Application.id.in_(app_ids)).all()

    if len(apps_in_db) != len(app_ids):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="One or more applications not found"
        )

    app_map = {app.id: app for app in apps_in_db}

    for app_update in req.applications:
        app_in_db = app_map[app_update.id]
        app_in_db.name = app_update.name
        app_in_db.is_active = app_update.is_active
        app_in_db.license_type = app_update.license_type

        if (
            app_update.license_type == ApplicationLicenseType.ENVIRONMENT
            and app_update.license_group is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group email is required for application with license type as ENVIRONMENT.",
            )

        if app_update.license_group:
            app_in_db.license_group = app_update.license_group

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"An unexpected error occurred during application update: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during application update.",
        )

@router.patch("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.post(
    "/applications",
    response_model=ApplicationCreateResponse
)
def create_applications(
    req: ApplicationCreateRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email)
):
    """
    Creates multiple new application
    """
    logger.info(f"Admin user {user_email}: Creating a new application with name: {req.name}")
    
    try:
        custom_schema_name = f"SAML_{req.custom_SAML_attribute.upper()}"
        
        application_data = req.model_dump()
        application_data['custom_SAML_attribute'] = custom_schema_name
        application_data['created_by'] = user_email

        new_application = Application(**application_data)
        db.add(new_application)
        db.commit()
        
        # Refresh the object to get the generated ID
        db.refresh(new_application)

        custom_schema_created = create_custom_schema(custom_schema_name, ACCOUNT_CUSTOMERID)

        logger.info(f"Successfully created application with ID: {new_application.id}")
        return new_application
        
    except IntegrityError as e:
        db.rollback()        
        logger.error(f"IntegrityError during application creation - {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Application with name '{req.name}' already exists."
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Failed to create application {req.name} - {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the application.",
        )

@router.patch("/reservations/{reservation_id}", response_model=ReservationOut)
def remove_app_from_reservations(
    reservation_id: int,
    req: RemoveAppFromReservationsRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Remove the applications associated with a specific reservation.
    """
    logger.info(
        f"Admin User {user_email}: Removing applications for reservation ID {reservation_id}"
    )

    reservation = (
        db.query(Reservation)
        .filter(Reservation.id == reservation_id)
        .one_or_none()
    )

    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found.",
        )

    if reservation.status not in [ReservationStatus.PENDING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending reservations can be modified."
        )

    new_app_ids = {req.primary_application_id} | set(req.secondary_application_ids)

    try:        
        reservation.applications.clear()
        
        new_applications = (
            db.query(Application).filter(Application.id.in_(new_app_ids)).all()
        )
        reservation.applications.extend(new_applications)
        # Update the primary_application_id in reservation table also
        reservation.primary_application_id = req.primary_application_id

        db.commit()
        db.refresh(reservation)

        logger.info(
            f"Successfully removed application for reservation {reservation_id}."
        )
        
        return reservation

    except Exception as e:
        db.rollback()
        logger.error(
            f"An unexpected error occurred while removing app from reservation: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while removing app from reservation.",
        )

@router.get("/reservations", response_model=List[ReservationOut])
def get_all_reservations(
    db: Session = Depends(get_db), user_email: str = Depends(get_user_email)
):
    """
    Retrieves all reservations.
    """
    logger.info(f"Admin User {user_email}: Fetching all reservations")
    reservations = db.query(Reservation).all()
    return reservations


@router.post(
    "/reservations/bulk-cancel",
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


@router.patch("/reservations/{reservation_id}/extend", response_model=ReservationOut)
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


@router.get("/bots", response_model=List[BotWithApplicationsOut])
def get_all_bots(db: Session = Depends(get_db)):
    """
    Retrieves all bots and the applications they support.
    """
    return get_bot_with_supported_apps(db).all()


@router.patch("/bots/{bot_id}/applications", response_model=BotWithApplicationsOut)
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

@router.post(
    "/bots/create", response_model=List[BotWithApplicationsOut], status_code=200
)
def create_bots(request: BotsCreateRequest, db: Session = Depends(get_db)):
    """
    Creates one or more new bots with their associated applications , checking for license count first.
    """ 
    # Check for the requested emails if already exist or not.
    requested_emails = [bot_data.email for bot_data in request.bots]
    existing_bots = (
        db.query(Bot.email)
        .filter(Bot.email.in_(requested_emails))
        .all()
    )
    # Showing tuples for my understading: existing_bots = [('bot1@example.com',), ('bot2@example.com',)]
    if existing_bots:        
        existing_emails = [bot[0] for bot in existing_bots]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Bot with Email '{', '.join(existing_emails)}' already exist.",
        )
    
    new_app_ids = set()
    for bot_data in request.bots:
        new_app_ids.update(bot_data.application_ids)

    # Check for license count for apps first if elegible to allocate or not
    if new_app_ids:
        license_counts = (
            db.query(
                Application.id,
                Application.name,
                Application.license_count,
                func.count(Bot.id).label("assigned_licenses"),
            )
            .join(Application.bots, isouter=True)
            .filter(Application.id.in_(new_app_ids))
            .group_by(Application.id, Application.name, Application.license_count)
            .all()
        )

        for app_id, app_name, total_licenses, assigned_licenses in license_counts:            
            total_licenses = int(total_licenses) if total_licenses is not None else 0                        
            if (total_licenses - assigned_licenses) <= 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"No licenses left for application '{app_name}'. Total: {total_licenses}, Assigned: {assigned_licenses}",
                )

    try:
        newly_created_bots = create_bot(request, db)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create bots: {str(e)}"
        )

    for bot in newly_created_bots:
        db.refresh(bot)

    return newly_created_bots

@router.patch(
    "/bots/update", response_model=List[BotWithApplicationsOut], status_code=200
)
def update_bots(request: BotsUpdateRequest, db: Session = Depends(get_db)):
    """
    Updates one or more existing bots and their associated applications,
    checking for license and reservation conflicts first.
    """
    # CHECK 1: # Check for license count for apps first if elegible to allocate or not.
    new_app_ids = set()
    for bot_data in request.bots:
        new_app_ids.update(bot_data.application_ids)

    if new_app_ids:
        license_counts = (
            db.query(
                Application.id,
                Application.name,
                Application.license_count,
                func.count(Bot.id).label("assigned_licenses"),
            )
            .join(Application.bots, isouter=True)
            .filter(Application.id.in_(new_app_ids))
            .group_by(Application.id, Application.name, Application.license_count)
            .all()
        )

        for app_id, app_name, total_licenses, assigned_licenses in license_counts:
            try:
                total_licenses = int(total_licenses) if total_licenses is not None else 0
            except (ValueError, TypeError):
                total_licenses = 0
            
            remaining_licenses = total_licenses - assigned_licenses
            
            if remaining_licenses <= 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"No licenses left for application '{app_name}'. Total: {total_licenses}, Assigned: {assigned_licenses}",
                )

    # CHECK 2: Per-Bot Conflict Check for removed applications
    for bot_data in request.bots:
        existing_bot = db.query(Bot).filter(Bot.id == bot_data.id).one_or_none()
        
        if not existing_bot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bot with ID '{bot_data.id}' does not exist and cannot be updated."
            )
            
        current_app_ids = {app.id for app in existing_bot.applications}        
        updated_app_ids = set(bot_data.application_ids)
        removed_app_ids = current_app_ids - updated_app_ids
        
        if removed_app_ids:
            conflicting_reservations = db.query(Reservation).filter(
                Reservation.bot_id == existing_bot.id,
                or_(
                    Reservation.status == ReservationStatus.ACTIVE,
                    Reservation.status == ReservationStatus.PENDING
                ),
                Reservation.applications.any(Application.id.in_(removed_app_ids))
            ).all()

            if conflicting_reservations:
                conflicting_apps = set()
                for res in conflicting_reservations:
                    for app in res.applications:
                        if app.id in removed_app_ids:
                            conflicting_apps.add(app.name)
                
                conflicting_app_names = ", ".join(conflicting_apps)
                
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Cannot remove applications {conflicting_app_names} "
                        f"from bot '{existing_bot.name}' because there are "
                        "existing active or pending reservations assigned to them."
                    )
                )

    try:
        updated_bots = update_bot(request, db)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update bots: {str(e)}",
        )

    for bot in updated_bots:
        db.refresh(bot)

    return updated_bots


@router.get("/downtimes", response_model=List[ApplicationDowntimeOut])
def get_all_downtimes(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Retrieves all application downtimes details.
    """
    logger.info(f"Admin user {user_email}: Fetching all application downtimes.")        
    downtimes = db.query(ApplicationDowntime).all()
    return downtimes

@router.post(
    "/schedule_downtime", status_code=200
)
def create_application_downtime(
    req: ApplicationDowntimeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Records downtime for a list of applications and schedules tasks to manage them.
    Checks for any overlapping downtimes or reservations before creation.
    Applicable for only inActive applications.
    """
    logger.info(
        f"Admin User {user_email}: Creating downtime entry for applications: {req.applications}"
    )

    app_ids = req.applications
    
    apps_in_db = db.query(Application).filter(Application.id.in_(app_ids)).all()
    if len(apps_in_db) != len(app_ids):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="One or more applications not found."
        )

    # Check for the active applications (Which are not allowed)
    active_applications = [app.name for app in apps_in_db if app.is_active is True]
    if active_applications:
        active_app_names = ", ".join(active_applications)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot schedule downtime. The following applications are currently ACTIVE and must be INACTIVE: {active_app_names}",
        )

    # Check for overlapping existing downtimes
    overlapping_downtimes = (
        db.query(ApplicationDowntime)
        .filter(
            ApplicationDowntime.application_id.in_(app_ids),
            ApplicationDowntime.downtime_start < req.downtime_end,
            ApplicationDowntime.downtime_end > req.downtime_start,
            ApplicationDowntime.status.in_([DowntimeStatus.PENDING, DowntimeStatus.ACTIVE])
        )
        .first()
    )
    if overlapping_downtimes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot schedule downtime. The requested time range overlaps with an ACTIVE or PENDING Downtime for one or more applications.",
        )

    # Check for overlapping existing reservations
    overlapping_reservations = (
        db.query(Reservation)
        .join(Reservation.applications)
        .filter(
            Application.id.in_(app_ids),
            Reservation.start_time < req.downtime_end,
            Reservation.end_time > req.downtime_start,
            Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE])
        )
        .first()
    )
    if overlapping_reservations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot schedule downtime. The requested time range overlaps with an ACTIVE or PENDING Reservation for one or more applications.",
        )

    # All checks pass, proceed with creating the downtime entry
    try:
        downtime_entries_to_schedule = []
        for app_id in req.applications:
            application_downtime = ApplicationDowntime(
                application_id=app_id,
                downtime_start=req.downtime_start,
                downtime_end=req.downtime_end,
                downtime_reason=req.downtime_reason,
                created_by=user_email,
                status=DowntimeStatus.PENDING,
            )
            db.add(application_downtime)
            downtime_entries_to_schedule.append(application_downtime)

        db.commit()
    
        for entry in downtime_entries_to_schedule:
            background_tasks.add_task(
                schedule_downtime_tasks,
                downtime_id=entry.id,
                downtime_start=entry.downtime_start.replace(tzinfo=timezone.utc),
                downtime_end=entry.downtime_end.replace(tzinfo=timezone.utc),
            )

    except Exception as e:
        db.rollback()
        logger.error(f"An unexpected error occurred during application downtime creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during application downtime creation.",
        )
        
    return {"message": "Downtime entry created successfully."}

@router.post(
    "/downtime/bulk-cancel",
    response_model=DowntimeBulkCancelResponse,
)
def bulk_cancel_downtime(
    req: DowntimeBulkCancelRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Cancels a list of application downtime entries by their IDs.
    """
    logger.info(
        f"Admin user {user_email}: Bulk canceling downtimes: {req.downtime_ids}"
    )

    successfully_cancelled = []
    failed_to_cancel = []
    
    # Query all downtimes to be cancelled in a single database hit
    downtimes_to_cancel = (
        db.query(ApplicationDowntime)
        .filter(ApplicationDowntime.id.in_(req.downtime_ids))
        .all()
    )
    downtime_map = {d.id: d for d in downtimes_to_cancel}

    for downtime_id in req.downtime_ids:
        downtime = downtime_map.get(downtime_id)
        
        # Check if the downtime exists and is in a cancellable state
        if not downtime or downtime.status in [DowntimeStatus.COMPLETED, DowntimeStatus.ACTIVE, DowntimeStatus.CANCELLED]:
            failed_to_cancel.append(downtime_id)
            continue
            
        # Update the status to CANCELLED and add to successfully_cancelled list
        downtime.status = DowntimeStatus.CANCELLED
        successfully_cancelled.append(downtime_id)
        
    try:
        db.commit()
        # Add background task to cancel the Cloud Tasks for each successfully cancelled downtime
        for downtime_id in successfully_cancelled:
            background_tasks.add_task(delete_downtime_tasks, downtime_id)

    except Exception as e:
        db.rollback()
        logger.error(
            f"Admin user {user_email}: An unexpected error occurred during bulk cancel: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while canceling downtimes.",
        )

    return DowntimeBulkCancelResponse(
        successfully_cancelled=successfully_cancelled,
        failed_to_cancel=failed_to_cancel
    )