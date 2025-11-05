import json
import os

# from cachetools import TTLCache, cached
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from loguru import logger
from typing import List

from .utils import get_secret_value
from .db.models import Application, Bot

# USER_CACHE_SIZE = 128
# USER_CACHE_TTL_SECONDS = 3600


def setup_admin_service():
    """Sets up the admin service for user profile management in Google Workspace Directory."""
    SCOPES = [
        "https://www.googleapis.com/auth/admin.directory.group",
        "https://www.googleapis.com/auth/admin.directory.user",
        "https://www.googleapis.com/auth/admin.directory.userschema",
        "https://www.googleapis.com/auth/admin.directory.orgunit"
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
# cache = TTLCache(maxsize=USER_CACHE_SIZE, ttl=USER_CACHE_TTL_SECONDS)


# @cached(cache)
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

def create_user(user_info):
    """Creates a new user in Google Workspace."""
    try:
        user = admin_service.users().insert(body=user_info).execute()
        return user
    except HttpError as error:
        if error.resp.status == 409:
            logger.error(f"admin_service: User {user_info['primaryEmail']} already exists.")
        else:
            logger.error(f"An error occurred while trying to create user: {error}")
        return None

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


def create_custom_schema(custom_schema_name, account_customerID):
    """
    Creates a custom SAML attribute schema for a given application using a synchronous insert API.
    """
    admin_service = setup_admin_service()

    request_body = {
        "displayName": custom_schema_name,
        "fields": [
            {
                "displayName": "Email",
                "fieldName": "Email",
                "fieldType": "STRING"
            },
            {
                "displayName": "Given Name",
                "fieldName": "Given_Name",
                "fieldType": "STRING"
            }
        ],
        "schemaName": custom_schema_name
    }

    try:
        logger.info(f"Creating new SAML attribute schema: {custom_schema_name}.")
        response = admin_service.schemas().insert(
            customerId=account_customerID,
            body=request_body
        ).execute()
        logger.info(
            f"Successfully created SAML attribute schema {custom_schema_name}."
            f" Response: {response}"
        )
        return response.get("schemaName")
    except Exception as e:
        logger.error(
            f"Error occurred while creating SAML attribute schema for {custom_schema_name}: {e}"
        )        
        raise e

def is_group_exists(group_email):
    """
    Check if the Group Email exists in workspace.
    """
    try:
        admin_service.groups().get(groupKey=group_email).execute()
        return True
    except HttpError as e:
        if e.resp.status == 404:
            logger.error(f"Group {group_email} does not exist.")
            return False
        else:
            logger.error(
                f"Error occurred while checking group {group_email} in workspace: {e}"
            )
            raise e
    except Exception as e:
        logger.error(
            f"An unexpected error occurred while checking group {group_email} in workspace: {e}"
        )
        raise e

def update_user_profile_with_new_info(user_email, updated_user_info):
    """
    Update the user profile with new fields.
    """
    try:
        updated_profile = admin_service.users().update(userKey=user_email, body=updated_user_info).execute()
        logger.info(f"Successfully updated user profile for {user_email}.")
        return updated_profile
    except Exception as e:
        logger.error(f"An unexpected error occurred during user profile update: {e}")
        raise e

def get_organization_units(customerId='C03ff1ejf'):
    """
    Retrieves a list of all organizational units for an account.
    """
    try:
        organization_units = admin_service.orgunits().list(customerId=customerId).execute()
        return organization_units.get('organizationUnits', [])
    except Exception as e:
        logger.error(f"An unexpected error occurred while retrieving organization units: {e}")
        raise e

def create_organization_unit(org_unit_data):
    """
    Calls the Admin SDK to create a new organizational unit.
    """
    try:
        response = admin_service.orgunits().insert(customerId='C03ff1ejf', body=org_unit_data).execute()
        return response
    except Exception as e:
        logger.error(f"Error creating organization unit: {e}")
        raise