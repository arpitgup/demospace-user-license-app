import json

from cachetools import TTLCache, cached
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from ..common.constants import (
    GCP_PROJECT_ID,
    ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME,
    DELEGATED_ADMIN,
    USER_CACHE_SIZE,
    USER_CACHE_TTL_SECONDS,
)
from ..utils.logging import logger
from .common import get_secret_value


SCOPES = [
    'https://www.googleapis.com/auth/admin.directory.group',
    'https://www.googleapis.com/auth/admin.directory.user',
]
service_account_info = get_secret_value(
    GCP_PROJECT_ID, ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME
)
credentials = service_account.Credentials.from_service_account_info(
    json.loads(service_account_info), scopes=SCOPES
)
delegated_credentials = credentials.with_subject(DELEGATED_ADMIN)
service = build("admin", "directory_v1", credentials=delegated_credentials)


cache = TTLCache(maxsize=USER_CACHE_SIZE, ttl=USER_CACHE_TTL_SECONDS)


@cached(cache)
def get_user(user_email):
    """Fetches user details from Google Workspace."""
    try:
        user = service.users().get(userKey=user_email).execute()
        return user
    except HttpError as error:
        if error.resp.status == 404:
            logger.error(f"admin_service: User {user_email} does not exist.")
        else:
            logger.error(f"An error occurred while trying to fetch user: {error}")
        return None
