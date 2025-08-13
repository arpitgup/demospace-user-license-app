import json
import os

from cachetools import TTLCache, cached
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from loguru import logger
from typing import List

from .utils import get_secret_value
from .db.models import Application, Bot


USER_CACHE_SIZE = 128
USER_CACHE_TTL_SECONDS = 3600


def setup_admin_service():
    """Sets up the admin service for user profile management in Google Workspace Directory."""
    SCOPES = [
        "https://www.googleapis.com/auth/admin.directory.group",
        "https://www.googleapis.com/auth/admin.directory.user",
    ]
    project_id = os.getenv("GCP_PROJECT_ID")
    secret_name = os.getenv("ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME")
    delegated_admin = os.getenv("DELEGATED_ADMIN")
    service_account_info = get_secret_value(project_id, secret_name)
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(service_account_info), scopes=SCOPES
    )
    delegated_credentials = credentials.with_subject(delegated_admin)
    return build("admin", "directory_v1", credentials=delegated_credentials)


admin_service = setup_admin_service()
cache = TTLCache(maxsize=USER_CACHE_SIZE, ttl=USER_CACHE_TTL_SECONDS)


@cached(cache)
def get_user(user_email):
    """Fetches user details from Google Workspace."""
    try:
        user = admin_service.users().get(userKey=user_email).execute()
        return user
    except HttpError as error:
        if error.resp.status == 404:
            logger.error(f"admin_service: User {user_email} does not exist.")
        else:
            logger.error(f"An error occurred while trying to fetch user: {error}")
        return None


def update_user_profile_with_saml_attributes(
    user_email: str, bot: Bot, applications: List[Application]
):
    """Updates the user profile with custom SAML attributes to activate the licenses."""
    try:
        logger.info(f"Updating user profile for {user_email}.")
        saml_info = {}
        saml_info["customSchemas"] = {}
        custom_schemas = saml_info["customSchemas"]
        for app in applications:
            APP_NAME = app.name.upper()
            custom_schemas[f"SAML_{APP_NAME}"] = {
                "Given_Name": bot.name,
                "Email": bot.email,
            }
        admin_service.users().update(userKey=user_email, body=saml_info).execute()
        logger.info(
            f"Successfully updated user profile for {user_email} with attributes {saml_info}."
        )
    except Exception as e:
        logger.error(
            f"Error occurred while updating user profile for {user_email}: {e}"
        )
        raise e


def clear_saml_attributes_for_user(user_email: str):
    """Updates the user profile to clear the custom SAML attributes to revoke the licenses."""
    try:
        logger.info(f"Clearing SAML attributes for {user_email}.")
        saml_info = {}
        saml_info["customSchemas"] = {}
        admin_service.users().update(userKey=user_email, body=saml_info).execute()
        logger.info(f"Successfully cleared SAML attributes for {user_email}.")
    except Exception as e:
        logger.error(
            f"Error occurred while clearing SAML attributes for {user_email}: {e}"
        )
        raise e
