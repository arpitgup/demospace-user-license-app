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


@cached(cache)
def is_user_in_group(user_email: str, group_email: str) -> bool:
    """Checks if a user is a member of a Google Workspace group."""
    try:
        admin_service.members().get(
            groupKey=group_email, memberKey=user_email
        ).execute()
        logger.info(f"User {user_email} is a member of group {group_email}.")
        return True
    except HttpError as e:
        if e.resp.status == 404:
            logger.info(f"User {user_email} is not a member of group {group_email}.")
            return False
        else:
            logger.error(
                f"Error occurred while checking membership for {user_email} in {group_email}: {e}"
            )
            raise e
    except Exception as e:
        logger.error(
            f"An unexpected error occurred while checking membership for {user_email} in {group_email}: {e}"
        )
        raise e


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


def get_user_details(user_email: str):
    """Fetches full user details from Google Workspace along with custom schema attributes."""
    try:
        user = (
            admin_service.users().get(userKey=user_email, projection="full").execute()
        )
        return user
    except HttpError as error:
        if error.resp.status == 404:
            logger.error(f"admin_service: User {user_email} does not exist.")
        else:
            logger.error(f"An error occurred while trying to fetch user: {error}")
        return None


def clear_saml_attributes_for_user(user_email: str):
    """Updates the user profile to clear the custom SAML attributes to revoke the licenses."""
    try:
        logger.info(f"Clearing SAML attributes for {user_email}.")
        user = get_user_details(user_email)
        if not user:
            return

        custom_schemas = user.get("customSchemas")
        if not custom_schemas:
            logger.info(f"User {user_email} has no custom schemas to clear.")
            return

        schemas_to_clear = {
            schema_name: {
                "Given_Name": "",
                "Email": "",
            }
            for schema_name in custom_schemas
            if schema_name.startswith("SAML_")
        }

        if not schemas_to_clear:
            logger.info(f"No SAML attributes found for user {user_email} to clear.")
            return

        body = {"customSchemas": schemas_to_clear}
        admin_service.users().patch(userKey=user_email, body=body).execute()
        logger.info(f"Successfully cleared SAML attributes for {user_email}.")
    except Exception as e:
        logger.error(
            f"Error occurred while clearing SAML attributes for {user_email}: {e}"
        )
        raise e


def add_user_to_group(user_email: str, group_email: str):
    """Adds a user to a Google Workspace group."""
    try:
        logger.info(f"Adding user {user_email} to group {group_email}.")
        member = {"email": user_email, "role": "MEMBER"}
        admin_service.members().insert(groupKey=group_email, body=member).execute()
        logger.info(f"Successfully added {user_email} to {group_email}.")
    except HttpError as e:
        if e.resp.status == 409:
            logger.warning(
                f"User {user_email} is already a member of group {group_email}."
            )
        else:
            logger.error(
                f"Error occurred while adding {user_email} to {group_email}: {e}"
            )
            raise e
    except Exception as e:
        logger.error(
            f"An unexpected error occurred while adding {user_email} to {group_email}: {e}"
        )
        raise e


def remove_user_from_group(user_email: str, group_email: str):
    """Removes a user from a Google Workspace group."""
    try:
        logger.info(f"Removing user {user_email} from group {group_email}.")
        admin_service.members().delete(
            groupKey=group_email, memberKey=user_email
        ).execute()
        logger.info(f"Successfully removed {user_email} from {group_email}.")
    except HttpError as e:
        # 404 Not Found indicates the user is not a member of the group
        if e.resp.status == 404:
            logger.warning(f"User {user_email} is not a member of group {group_email}.")
        else:
            logger.error(
                f"Error occurred while removing {user_email} from {group_email}: {e}"
            )
            raise e
    except Exception as e:
        logger.error(
            f"An unexpected error occurred while removing {user_email} from {group_email}: {e}"
        )
        raise e
