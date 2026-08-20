from fastapi import Depends
from shared_lib.dependencies import get_db
from sqlalchemy.orm import Session
from loguru import logger
from shared_lib import admin_service
from shared_lib.thirdparty_services import box_service
from shared_lib.db.models import Reservation, ApplicationLicenseType, Application, ApplicationDowntime
from shared_lib.enums import DowntimeStatus


def provision_subscription_licenses(reservation: Reservation):
    subscription_apps = [
        app
        for app in reservation.applications
        if app.license_type == ApplicationLicenseType.SUBSCRIPTION
    ]
    admin_service.update_user_profile_with_saml_attributes(
        user_email=reservation.user_email,
        bot=reservation.bot,
        applications=subscription_apps,
    )


def provision_environment_licenses(reservation: Reservation):
    env_based_apps = [
        app
        for app in reservation.applications
        if app.license_type == ApplicationLicenseType.ENVIRONMENT
    ]
    for app in env_based_apps:
        admin_service.add_user_to_group(
            user_email=reservation.user_email, group_email=app.license_group
        )


def provision_api_managed_licenses(reservation: Reservation):
    api_managed_apps = [
        app
        for app in reservation.applications
        if app.license_type == ApplicationLicenseType.API_MANAGED
    ]
    for app in api_managed_apps:
        if app.name.lower() == "box":
            box_service.provision_box_user(
                user_email=reservation.user_email,
                user_name=reservation.user_email,
            )
        # Future API_MANAGED apps:
        # elif app.name.lower() == "newapp":
        #     newapp_service.provision_user(...)
        else:
            logger.warning(f"No provisioning handler for API_MANAGED app: {app.name}. Skipping.")


def provision_app_licenses(reservation: Reservation):
    provision_subscription_licenses(reservation)
    provision_environment_licenses(reservation)
    provision_api_managed_licenses(reservation)


def deprovision_subscription_licenses(reservation: Reservation):
    admin_service.clear_saml_attributes_for_user(reservation.user_email)


def deprovision_environment_licenses(reservation: Reservation):
    env_based_apps = [
        app
        for app in reservation.applications
        if app.license_type == ApplicationLicenseType.ENVIRONMENT
    ]
    for app in env_based_apps:
        admin_service.remove_user_from_group(
            user_email=reservation.user_email, group_email=app.license_group
        )


def deprovision_api_managed_licenses(reservation: Reservation):
    api_managed_apps = [
        app
        for app in reservation.applications
        if app.license_type == ApplicationLicenseType.API_MANAGED
    ]
    for app in api_managed_apps:
        if app.name.lower() == "box":
            box_service.deprovision_box_user(user_email=reservation.user_email)
        # Future API_MANAGED apps:
        # elif app.name.lower() == "newapp":
        #     newapp_service.deprovision_user(...)
        else:
            logger.warning(f"No deprovisioning handler for API_MANAGED app: {app.name}. Skipping.")


def deprovision_app_licenses(reservation: Reservation):
    deprovision_subscription_licenses(reservation)
    deprovision_environment_licenses(reservation)
    deprovision_api_managed_licenses(reservation)

def deactivate_applications(downtime_id: int, db: Session = Depends(get_db)):
    """Deactivates applications associated with a downtime entry."""
    try:
        downtime_entry = db.query(ApplicationDowntime).filter(ApplicationDowntime.id == downtime_id).first()
        if not downtime_entry:
            logger.warning(f"Downtime entry {downtime_id} not found. Cannot deactivate applications.")
            return

        application = db.query(Application).filter(Application.id == downtime_entry.application_id).first()
        if application:
            application.is_active = False
            db.commit()
            logger.info(f"Application {application.name} deactivated due to scheduled downtime.")
        else:
            logger.warning(f"Application with ID {downtime_entry.application_id} not found for downtime {downtime_id}.")
            
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to deactivate application for downtime {downtime_id}: {e}")
        raise

def activate_applications(downtime_id: int, db: Session = Depends(get_db)):
    """Activates applications associated with a downtime entry."""
    try:
        downtime_entry = db.query(ApplicationDowntime).filter(ApplicationDowntime.id == downtime_id).first()
        if not downtime_entry:
            logger.warning(f"Downtime entry {downtime_id} not found. Cannot activate applications.")
            return

        application = db.query(Application).filter(Application.id == downtime_entry.application_id).first()
        if application:
            application.is_active = True
            db.commit()
            logger.info(f"Application {application.name} activated after scheduled downtime.")
        else:
            logger.warning(f"Application with ID {downtime_entry.application_id} not found for downtime {downtime_id}.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to activate application for downtime {downtime_id}: {e}")
        raise