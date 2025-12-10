from datetime import timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import func, or_, case, asc, desc
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from shared_lib.db.models import (
    Application,
    ApplicationLicenseType,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
    ApplicationDowntime,
    DemoDetail,
    OrganizationUnits
)
from shared_lib.dependencies import get_user_email, get_db, get_app_config
from typing import List, Optional
from shared_lib.enums import DowntimeStatus, DemoOnboardingStatus
from shared_lib.admin_service import create_custom_schema, is_group_exists, get_user, get_organization_units, create_organization_unit
from ..common.constants import ACCOUNT_CUSTOMERID, RESERVATION_EMAIL_SENDER, BOOKED_RESERVATION_EMAIL_CONTENT
from datetime import datetime
from ..common.schemas import (
    ApplicationWithLicenseGroupOut,
    BulkCancelReservationsRequest,
    BulkCancelReservationsResponse,
    ExtendReservationRequest,
    AdminCreateReservationRequest,
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
    RemoveAppFromReservationsRequest,
    OnboardedDemoDetailsOut,
    UpdateOnboardedDemoDetailsRequest,
    UpdateOnboardedDemoDetailsResponse,
    OnboardNewDemoRequestResponse,
    OrganizationUnitLocalOut,
    RepresentativeProfileOut,
    OrganizationUnitCreateRequest,
    PaginatedReservationsOut
)
from ..utils.background_tasks import (
    delete_reservation_tasks,
    schedule_deprovisioning_task,
    delete_license_deprovisioning_task,
    schedule_downtime_tasks,
    delete_downtime_tasks,
    schedule_reservation_tasks,
    sendReservationEmail
)
from ..utils.crud import get_bot_with_supported_apps, create_bot, update_bot, find_available_bot, format_email_for_reservation

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
    Updates name, status, license count & license group for multiple applications.
    """
    logger.info(f"Admin User {user_email}: Updating applications: {req.applications}")

    app_ids = [app.id for app in req.applications]

    apps_in_db = db.query(Application).filter(Application.id.in_(app_ids)).all()
    if len(apps_in_db) != len(app_ids):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="One or more applications not found"
        )

    assigned_bots_count = (
        db.query(Application.id, func.count(Bot.id).label('assigned_licenses'))
        .outerjoin(Application.bots)
        .filter(Application.id.in_(app_ids))
        .group_by(Application.id)
        .all()
    )
    assigned_bots_count_map = {
        app_id: count for app_id, count in assigned_bots_count
    }
    app_map = {app.id: app for app in apps_in_db}

    for app_update in req.applications:
        app_in_db = app_map[app_update.id]
        # --- License Count Validation ---
        new_license_count_str = app_update.license_count
        assigned_count = assigned_bots_count_map.get(app_update.id, 0)
        try:
            new_license_count = int(new_license_count_str) if new_license_count_str else 0
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid license count format for application ID {app_update.id}. Must be an integer or None.",
            )
        if new_license_count < assigned_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Assigned licenses are {assigned_count}. Cannot reduce the license count for application '{app_in_db.name}' to {new_license_count}."
                ),
            )
        # --- End License Count Validation ---
        app_in_db.name = app_update.name
        app_in_db.is_active = app_update.is_active
        app_in_db.license_type = app_update.license_type
        app_in_db.license_count = app_update.license_count

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
        # Check first the app Name is already exist or not.
        app_name = db.query(Application).filter(Application.name == req.name).all()
        if app_name:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Application with name '{req.name}' already exists."
            )

        application_data = req.model_dump()

        if req.license_type == ApplicationLicenseType.SUBSCRIPTION:
            if not req.name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Name is required for applications.",
                )
            # if not req.custom_SAML_attribute:
            #     raise HTTPException(
            #         status_code=status.HTTP_400_BAD_REQUEST,
            #         detail="Custom SAML attribute is required for subscription applications.",
            #     )
            custom_schema_name = f"SAML_{req.name.upper()}"
            custom_schema_created = create_custom_schema(custom_schema_name, ACCOUNT_CUSTOMERID)
            application_data['custom_SAML_attribute'] = custom_schema_name

        elif req.license_group:
            if not is_group_exists(req.license_group):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{req.license_group} is not a valid group.",
                )

        application_data['created_by'] = user_email
        new_application = Application(**application_data)

        db.add(new_application)
        db.commit()
        db.refresh(new_application)

        logger.info(f"Successfully created application with ID: {new_application.id}")
        return new_application

    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Could not create reservation due to a database error.",
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            f"Failed to create application {req.name} due to unexpected error - {type(e).__name__}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the application. Check server logs for details."
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

# @router.get("/reservations", response_model=List[ReservationOut])
# def get_all_reservations(
#     db: Session = Depends(get_db), user_email: str = Depends(get_user_email)
# ):
#     """
#     Retrieves all reservations.
#     """
#     logger.info(f"Admin User {user_email}: Fetching all reservations")
#     reservations = db.query(Reservation).all()
#     return reservations


@router.get("/reservations", response_model=PaginatedReservationsOut)
def get_all_reservations(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
    searchbyUser: Optional[str] = Query(None, description="Filter by user email (partial match)"),
    searchbyApp: Optional[str] = Query(None, description="Filter by application name (partial match)"),
    searchbyDate: Optional[str] = Query(None, description="Filter by reservation date (e.g., '2024-10-27')"),
    searchbyBot: Optional[str] = Query(None, description="Filter by bot name (partial match)"),
    pageIndex: Optional[int] = Query(None, ge=0, description="Page number (indexing from 0)"),
    pageSize: Optional[int] = Query(None, ge=1, description="Size of page"),
    pastReservations: Optional[bool] = Query(None, description="Filter by past/current reservations"),
):
    """
    Retrieves a paginated list of all reservations, with multiple filtering and sorting.
    """
    base_query = db.query(Reservation)
    base_query = base_query.join(Reservation.bot)

    active_and_pending_statuses = [
        ReservationStatus.ACTIVE,
        ReservationStatus.PENDING,
    ]
    completed_and_cancelled_statuses = [
        ReservationStatus.COMPLETED,
        ReservationStatus.CANCELLED,
    ]

    is_special_sorting = False
    if pastReservations is not None:
        if pastReservations:
            statuses_to_filter = completed_and_cancelled_statuses
        else:
            statuses_to_filter = active_and_pending_statuses
            is_special_sorting = True
            
        base_query = base_query.filter(Reservation.status.in_(statuses_to_filter))
    
    if searchbyUser:
        base_query = base_query.filter(Reservation.user_email.ilike(f"%{searchbyUser}%"))

    if searchbyBot:
        base_query = base_query.filter(Bot.name.ilike(f"%{searchbyBot}%"))

    if searchbyApp:
        base_query = base_query.join(Reservation.applications).filter(
            Application.name.ilike(f"%{searchbyApp}%")
        )

    if searchbyDate:
        try:
            search_date = date_parser.parse(searchbyDate).date()
            start_of_day = datetime.combine(search_date, datetime.min.time(), tzinfo=Reservation.start_time.type.timezone)
            end_of_day = datetime.combine(search_date, datetime.max.time(), tzinfo=Reservation.start_time.type.timezone)

            base_query = base_query.filter(
                Reservation.start_time >= start_of_day,
                Reservation.start_time <= end_of_day,
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for 'searchbyDate'. Use a format like YYYY-MM-DD.",
            )
    
    # Sorting: ONLY applied if filtering for current/upcoming reservations
    if is_special_sorting:
        status_rank = case(
            (Reservation.status == ReservationStatus.ACTIVE, 1),
            (Reservation.status == ReservationStatus.PENDING, 2),
            else_=3 # Default rank for safety
        )
        
        base_query = base_query.order_by(asc(status_rank))

    base_query = base_query.order_by(desc(Reservation.start_time))

    total_records = base_query.count()
    reservations_query = base_query
    
    response_page_index = pageIndex if pageIndex is not None else 0
    response_page_size = pageSize if pageSize is not None else total_records

    if pageIndex is not None and pageSize is not None:
        offset = pageIndex * pageSize
        reservations_query = reservations_query.limit(pageSize).offset(offset)
        
        response_page_index = pageIndex
        response_page_size = pageSize

    reservations = reservations_query.distinct().all()

    return PaginatedReservationsOut(
        data=reservations,
        totalRecords = total_records,
        pageIndex = response_page_index,
        pageSize = response_page_size
    )


@router.post(
    "/reservations",
    response_model=ReservationOut
)
def create_reservation(
    req: AdminCreateReservationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
):
    """
    Creates a new reservation.
    """
    logger.info(f"Admin User {user_email}: Creating a new reservation")

    # CHECK 1: Check if user email exist in workspace or not.
    candidate_useremail = req.candidate_user_email
    user = get_user(candidate_useremail)
    if not user:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": f"User {candidate_useremail} is not a valid user."}
    )

    all_app_ids = [req.primary_application_id] + req.secondary_application_ids
    unique_app_ids = list(set(all_app_ids))

    # CHECK 2: Check if all requested applications exist
    apps_in_db = db.query(Application).filter(Application.id.in_(unique_app_ids)).all()
    if len(apps_in_db) != len(unique_app_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more requested application IDs do not exist.",
        )

    # CHECK 3: Check if there is any Existing Reservation for that user on that datetime range.
    existing_reservation = (
        db.query(Reservation)
        .filter(
            Reservation.user_email == candidate_useremail,
            Reservation.status.in_([ReservationStatus.ACTIVE, ReservationStatus.PENDING]),
            Reservation.start_time < req.end_time,
            Reservation.end_time > req.start_time,
        )
        .first()
    )
    if existing_reservation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User {candidate_useremail} already have an existing reservation on same Date Range. Please cancel it & book again."
        )

    # CHECK 4: Check if there is conflicting Downtime for that app on that datetime range.
    conflicting_downtime = (
        db.query(ApplicationDowntime)
        .filter(
            ApplicationDowntime.application_id.in_(unique_app_ids),
            ApplicationDowntime.status.in_(
                [DowntimeStatus.PENDING, DowntimeStatus.ACTIVE]
            ),
            ApplicationDowntime.downtime_start < req.end_time,
            ApplicationDowntime.downtime_end > req.start_time,
        )
        .first()
    )
    if conflicting_downtime:
        conflicting_app_name = (
            db.query(Application.name)
            .filter(Application.id == conflicting_downtime.application_id)
            .scalar()
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot make a reservation. Application '{conflicting_app_name}' has scheduled downtime that conflicts with your requested time.",
        )

    # Find Admin bots first that supports ALL requested applications
    candidate_bots_admin_query = (
        db.query(Bot)
        .join(Bot.supported_applications)
        .filter(BotApplication.application_id.in_(unique_app_ids))
        .filter(Bot.is_admin == True)
        .group_by(Bot.id)
        .having(func.count(BotApplication.application_id) == len(unique_app_ids))
    )
    candidate_bots = candidate_bots_admin_query.all()
    suitable_bot = find_available_bot(db, candidate_bots, unique_app_ids, req.start_time, req.end_time)
    if not suitable_bot:
        logger.info("No suitable admin bot found. Checking for non-admin bots.")

        candidate_bots_non_admin_query = (
            db.query(Bot)
            .join(Bot.supported_applications)
            .filter(BotApplication.application_id.in_(unique_app_ids))
            .filter(Bot.is_admin == False)
            .group_by(Bot.id)
            .having(func.count(BotApplication.application_id) == len(unique_app_ids))
        )
        candidate_bots = candidate_bots_non_admin_query.all()
        if not candidate_bots:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No single bot found that supports all requested applications.",
            )

        suitable_bot = find_available_bot(db, candidate_bots, unique_app_ids, req.start_time, req.end_time)
    if not suitable_bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Found bots that support all applications, but none are available for the requested time.",
        )

    new_reservation = Reservation(
        user_email=candidate_useremail,
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
            f"Successfully created reservation {new_reservation.id} for user {candidate_useremail} with bot {suitable_bot.name}"
        )
        background_tasks.add_task(
            schedule_reservation_tasks,
            new_reservation.id,
            new_reservation.start_time.replace(tzinfo=timezone.utc),
            new_reservation.end_time.replace(tzinfo=timezone.utc),
        )
        background_tasks.add_task(
            sendReservationEmail,
            recipient_email=candidate_useremail,
            sender_email=app_config[RESERVATION_EMAIL_SENDER],
            reservation_id=new_reservation.id,
            subject="Your Agentspace License Reservation Confirmation",
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
            f"An unexpected error occurred while creating the reservation for user {candidate_useremail}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while creating the reservation.",
        )

    return new_reservation

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

    # Check Bot User Email Validity if exist in workspace or not.
    invalid_emails = []
    for email in requested_emails:
        user = get_user(email)
        if not user:
            invalid_emails.append(email)
            continue
    if invalid_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bot Email '{', '.join(invalid_emails)}' does not exists.",
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
    checking for license availability only for newly added applications.
    """
    all_newly_added_app_ids = set()

    for bot_data in request.bots:
        bot_id = bot_data.id
        requested_app_ids = set(bot_data.application_ids)

        current_bot = db.query(Bot).filter(Bot.id == bot_id).first()
        if not current_bot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bot with ID '{bot_id}' not found.",
            )

        existing_app_ids = {app.id for app in current_bot.applications}
        newly_added_app_ids = requested_app_ids - existing_app_ids
        all_newly_added_app_ids.update(newly_added_app_ids)

    if all_newly_added_app_ids:
        license_counts = (
            db.query(
                Application.id,
                Application.name,
                Application.license_count,
                func.count(Bot.id).label("assigned_licenses"),
            )
            .join(Application.bots, isouter=True)
            .filter(Application.id.in_(all_newly_added_app_ids))
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

@router.get("/get-onboarded-demos", response_model=List[OnboardedDemoDetailsOut])
def get_onboarded_demo_details(db: Session = Depends(get_db)):
    """
    Retrieves all demos that have been onboarded in license app.
    """
    query_results = db.query(DemoDetail).all()
    output_list: List[OnboardedDemoDetailsOut] = []

    for demo_record in query_results:
        representative_profile_out = RepresentativeProfileOut(
            cost_centre=demo_record.cost_centre,
            manager_name=demo_record.manager_name,
            manager_email=demo_record.manager_email,
            manager_title=demo_record.manager_title,
            rep_role=demo_record.rep_role,
            rep_department=demo_record.rep_department,
        )
        demo_details_out = OnboardedDemoDetailsOut(
            demo_id=demo_record.demo_id,
            demo_title=demo_record.demo_title,
            demo_user_group_email=demo_record.demo_user_group_email,
            gemini_enterprise_app_link=demo_record.gemini_enterprise_app_link,
            drive_folder_link=demo_record.drive_folder_link,
            demo_onboarding_status=demo_record.demo_onboarding_status,
            feature_license_app=demo_record.feature_license_app,
            saas_applications=demo_record.saas_applications,
            organization_unit=demo_record.organization_unit,
            representative_profile=representative_profile_out,
        )
        output_list.append(demo_details_out)
    return output_list

@router.post("/onboard_new_demo", response_model=OnboardNewDemoRequestResponse, status_code=status.HTTP_201_CREATED)
def onboard_new_demo(req: OnboardNewDemoRequestResponse, db: Session = Depends(get_db), user_email: str = Depends(get_user_email)):
    """
    Onboard a new demo.
    """
    logger.info(f"Admin User {user_email}: Attempting to onboard new demo: {req.demo_id}")

    existing_demo = db.query(DemoDetail).filter(
        DemoDetail.demo_id == req.demo_id
    ).first()
    if existing_demo:
        current_status = existing_demo.demo_onboarding_status.value
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Demo with ID '{req.demo_id}' already exists. Current status is {current_status}."
        )
    try:
        if not req.demo_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Demo Title is required."
            )

        demo_user_group_email = req.demo_user_group_email
        if not demo_user_group_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Demo User Group Email is required."
            )
        # External Group Existence Check
        if not is_group_exists(demo_user_group_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{demo_user_group_email} is not a valid group.",
            )
        
        if not req.gemini_enterprise_app_link:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gemini Enterprise App Link is required."
            )
            
        # Demo Onboarding Status check
        if not req.demo_onboarding_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Demo Onboarding Status is required."
            )

        # Feature License App check
        if req.feature_license_app is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feature License App is required and must be a boolean value (True or False)."
            )
            
        # Organization Unit validations

        # VALIDATION: 1 (Attribute Check)
        org_unit_path = req.organization_unit
        if not org_unit_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization Unit path is required."
            )
        # VALIDATION: 2 (Looking up Google Admin workspace console)
        existing_organization_units = get_organization_units()
        org_unit_exists = any(
            org_unit.get('orgUnitPath') == org_unit_path
            for org_unit in existing_organization_units
        )
        if not org_unit_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organization Unit path '{org_unit_path}' does not exist in external system."
            )
        # VALIDATION: 3 (Looking up in the DB if entried or not)
        canonical_org_unit = db.query(OrganizationUnits).filter(
            OrganizationUnits.orgunitpath == org_unit_path
        ).first()
        if not canonical_org_unit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organizational Unit path '{org_unit_path}' not found in table 'Organization Unit'."
            )

        # Manager Email validations
        manager_email = req.manager_email
        if not manager_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manager Email is required."
            )
        manager_details = get_user(manager_email)
        if not manager_details:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": f"Manager Email {manager_email} is not a valid email."}
        )

        demo_data = req.model_dump(exclude_unset=True)
        new_demo = DemoDetail(**demo_data)
        
        db.add(new_demo)
        db.commit()
        db.refresh(new_demo)
        
        logger.info(f"Admin User {user_email}: Successfully onboarded new demo: {req.demo_id}")
        return new_demo

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            f"Admin user {user_email}: An unexpected error occurred during demo onboarding: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while attempting to onboard the new demo."
        )

@router.patch("/update-onboarded-demos/{demo_id}", response_model=UpdateOnboardedDemoDetailsResponse)
def update_onboarded_demos(demo_id: str, req: UpdateOnboardedDemoDetailsRequest, db: Session = Depends(get_db), user_email: str = Depends(get_user_email)):
    """
    Updates demo details.
    """
    logger.info(f"Admin User {user_email}: Attempting to update onboarded demo ID: {demo_id}")

    demo_title = req.demo_title
    if not demo_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demo Title is required."
        )

    demo_user_group_email = req.demo_user_group_email
    if not demo_user_group_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demo User Group Email is required."
        )
    if not is_group_exists(demo_user_group_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{demo_user_group_email} is not a valid group.",
        )
    
    gemini_enterprise_app_link = req.gemini_enterprise_app_link
    if not gemini_enterprise_app_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gemini Enterprise App Link is required."
        )
    
    demo_onboarding_status = req.demo_onboarding_status
    if not demo_onboarding_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demo Onboarding Status is required."
        )

    feature_license_app = req.feature_license_app
    if feature_license_app is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feature License App is required and must be a boolean value (True or False)."
        )
    
    org_unit_path = req.organization_unit
    if not org_unit_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization Unit path is required."
        )
    existing_organization_units = get_organization_units()
    org_unit_exists = any(
        org_unit.get('orgUnitPath') == org_unit_path
        for org_unit in existing_organization_units
    )
    if not org_unit_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization Unit path '{org_unit_path}' does not exist."
        )

    if req.manager_email:
        manager_details = get_user(req.manager_email)
        if not manager_details:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": f"Manager Email {req.manager_email} is not a valid email."}
        )

    update_data = req.model_dump(exclude_unset=True)
    # If someone mistakly passed demoID from request model
    update_data.pop('demo_id', None)

    updated_rows = db.query(DemoDetail).filter(DemoDetail.demo_id == demo_id).update(update_data, synchronize_session="fetch")
    
    if updated_rows == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Demo Detail Update failed: Demo ID {demo_id} not found.")

    try:
        db.commit()
        logger.info(f"Admin User {user_email}: Successfully updated {updated_rows} row(s) for demo ID: {demo_id}")
    except Exception as e:
        db.rollback()
        logger.error(
            f"Admin user {user_email}: An unexpected error occurred during update: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while attempting to update the demo details.",
        )
    
    updated_demo_details = db.query(DemoDetail).filter(
        DemoDetail.demo_id == demo_id
    ).first()
    return updated_demo_details

@router.get("/organization/list_organization_units", response_model=List[OrganizationUnitLocalOut])
def list_organization_units(db: Session = Depends(get_db), user_email: str = Depends(get_user_email)):
    """
    Retrieves unique organizational units from the local 'organization_units' database table.
    """
    logger.info(f"Admin User {user_email}: Attempting to retrieve unique organization units (full details) from local database.")
    
    try:
        unique_units_list = db.query(OrganizationUnits).distinct().all()        
        units_count = len(unique_units_list)
        logger.info(f"Admin User {user_email}: Successfully retrieved {units_count} unique organization units from local database.")
        
        return unique_units_list
        
    except Exception as e:
        logger.error(f"Admin User {user_email}: An unexpected error occurred while retrieving local organization units: {e}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve local organization units. Details: {e}"
        )

@router.post("/organization-units", response_model=OrganizationUnitLocalOut, status_code=status.HTTP_201_CREATED)
def write_organization_unit(req: OrganizationUnitCreateRequest, db: Session = Depends(get_db), user_email: str = Depends(get_user_email)):
    """
    Write a new Organization Unit record in the database, checking for existing records first.
    """
    logger.info(f"Admin User {user_email}: Attempting to create new Organization Unit for path: {req.orgunitpath}")
    organization_unit_path = req.orgunitpath
    if not organization_unit_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization Unit path is required."
        )

    existing_org_unit = db.query(OrganizationUnits).filter(
        OrganizationUnits.orgunitpath.ilike(organization_unit_path)
    ).first()
    if existing_org_unit:
        error_detail = f"Organization Unit with path '{organization_unit_path}' already exists."
        logger.warning(error_detail)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_detail
        )

    new_org_unit = OrganizationUnits(**req.model_dump())
    db.add(new_org_unit)
    try:
        db.commit()
        db.refresh(new_org_unit)
        logger.info(f"Successfully created Organization Unit with ID: {new_org_unit.id}")
        return new_org_unit
    
    except IntegrityError as e:
        db.rollback()
        detail = "A database constraint violation occurred (e.g., duplicate key)."
        logger.error(f"Organization Unit creation failed due to IntegrityError: {detail}. Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"An unexpected error occurred during Organization Unit creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the organization unit.",
        )

# @router.delete("/delete-onboarded-demos/{demo_id}")
# def delete_onboarded_demos(
#     demo_id: str, 
#     db: Session = Depends(get_db), 
#     user_email: str = Depends(get_user_email)
# ):
#     """
#     Deletes an onboarded demo record from the DemoDetail table.
#     """
#     logger.warning(f"Admin User {user_email}: Attempting to delete demo ID: {demo_id}")

#     demo_details = db.query(DemoDetail).filter(
#         DemoDetail.demo_id == demo_id).all()
#     if not demo_details:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Demo ID {demo_id} not found."
#         )

#     try:
#         db.query(DemoDetail).filter(DemoDetail.demo_id == demo_id).delete()
#         db.commit()
#         logger.info(f"Admin User {user_email}: Successfully deleted Demo: {demo_id}")
        
#     except Exception as e:
#         db.rollback()
#         logger.error(
#             f"Admin user {user_email}: An unexpected error occurred during deletion: {e}"
#         )
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"An unexpected error occurred while attempting to delete the demo details.{e}",
#         )

# @router.get("/organization/get_org_units_workspace", response_model=List[OrgUnitOut])
# def get_org_units_workspace(
#     user_email: str = Depends(get_user_email)
# ):
#     """
#     Retrieves a list of all organizational units from the workspace.
#     """
#     logger.info(f"Admin User {user_email}: Attempting to retrieve organization units from workspace.")
    
#     try:
#         response_data = get_organization_units()
#         logger.info(f"Admin User {user_email}: Successfully retrieved organization units from workspace.")
#         return response_data
#     except Exception as e:
#         logger.error(f"Admin User {user_email}: An unexpected error occurred while retrieving organization units: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to retrieve organization units for customer {customerId}. Details: {e}"
#         )


# @router.post("/organization/create_org_unit", response_model=OrgUnitResponse, status_code=status.HTTP_201_CREATED)
# def create_org_unit_api(
#     req: CreateOrgUnitRequest,    
#     user_email: str = Depends(get_user_email),
#     db: Session = Depends(get_db)
# ):
#     """
#     Creates a new organizational unit for a workspace.
#     """
#     logger.info(f"Admin User {user_email}: Attempting to create new org unit '{req.org_unit_name}' for workspace.")
    
#     try:
#         org_unit_data = req.model_dump()
#         org_unit_info = {
#             'name': org_unit_data.get('org_unit_name'),
#             'parentOrgUnitPath': "/",
#             'description': org_unit_data.get('description'),
#         }
#         created_unit_data = create_organization_unit(org_unit_info=org_unit_info)
#         if not created_unit_data:
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail="Failed to create organization unit."
#             )
#         local_db_data = {
#             'orgunitpath': created_unit_data.get('orgUnitPath'),
#             'description': created_unit_data.get('description'),
#             'cost_centre': org_unit_data.get('cost_centre'),
#             'manager_name': org_unit_data.get('manager_name'),
#             'manager_email': org_unit_data.get('manager_email'),
#             'manager_title': org_unit_data.get('manager_title'),
#             'rep_role': org_unit_data.get('rep_role'),
#             'rep_department': org_unit_data.get('rep_department'),
#         }

#         new_local_org_unit = OrganizationUnits(**local_db_data)
#         db.add(new_local_org_unit)
#         db.commit()

#         logger.info(f"Admin User {user_email}: Successfully created org unit: {created_unit_data.get('orgUnitPath')} & saved data in DB.")        
#         return created_unit_data
    
#     except Exception as e:
#         db.rollback()
#         error_detail = str(e)
#         logger.error(f"Admin User {user_email}: Error during org unit creation: {e}")

#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to create organization unit due to an unexpected server error. Details: {e}"
#         )