from shared_lib import admin_service
from shared_lib.db.models import Reservation, ApplicationLicenseType


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
            user_email=reservation.user_email, group_email=app.license_group.group_email
        )


def provision_app_licenses(reservation: Reservation):
    provision_subscription_licenses(reservation)
    provision_environment_licenses(reservation)


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
            user_email=reservation.user_email, group_email=app.license_group.group_email
        )


def deprovision_app_licenses(reservation: Reservation):
    deprovision_subscription_licenses(reservation)
    deprovision_environment_licenses(reservation)
