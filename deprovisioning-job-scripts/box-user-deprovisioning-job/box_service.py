"""
Box Admin API client for user deprovisioning.

Uses the Box Python SDK with Client Credentials Grant (CCG) authentication
to manage users in the Box enterprise environment.
"""

import os
from typing import List, Optional

from boxsdk import CCGAuth, Client
from loguru import logger

from shared_lib.utils import get_secret_value


# Domain filter for users eligible for deprovisioning
DEMOSPACE_USER_DOMAIN = "@demospace.altostrat.com"


def setup_box_client() -> Client:
    """
    Initialize Box CCG auth using enterprise ID + client credentials from Secret Manager.

    Required environment variables:
        - GCP_PROJECT_ID: Google Cloud project ID
        - BOX_ENTERPRISE_ID_SECRET_NAME: Secret name for Box enterprise ID
        - BOX_CLIENT_ID_SECRET_NAME: Secret name for Box client ID
        - BOX_CLIENT_SECRET_SECRET_NAME: Secret name for Box client secret
    """
    project_id = os.getenv("GCP_PROJECT_ID")
    if not project_id:
        raise ValueError("GCP_PROJECT_ID environment variable is not set.")

    enterprise_id = get_secret_value(
        project_id, os.getenv("BOX_ENTERPRISE_ID_SECRET_NAME")
    )
    client_id = get_secret_value(
        project_id, os.getenv("BOX_CLIENT_ID_SECRET_NAME")
    )
    client_secret = get_secret_value(
        project_id, os.getenv("BOX_CLIENT_SECRET_SECRET_NAME")
    )

    if not all([enterprise_id, client_id, client_secret]):
        raise ValueError(
            "Failed to retrieve one or more Box API secrets from Secret Manager."
        )

    auth = CCGAuth(
        client_id=client_id,
        client_secret=client_secret,
        enterprise_id=enterprise_id,
    )
    client = Client(auth)
    logger.info("Box client initialized successfully via CCG auth.")
    return client


def list_box_enterprise_users(
    client: Client,
    user_domain_filter: str = DEMOSPACE_USER_DOMAIN,
) -> List[dict]:
    """
    List all managed users in the Box enterprise, filtered to a specific domain.

    Args:
        client: Authenticated Box SDK client.
        user_domain_filter: Only return users whose login (email) ends with this domain.

    Returns:
        List of dicts with 'id', 'login' (email), and 'name' for each matching user.
    """
    all_users = []
    offset = 0
    limit = 100

    try:
        while True:
            users_page = client.users(
                user_type="managed", offset=offset, limit=limit
            )
            page_users = list(users_page)

            if not page_users:
                break

            for user in page_users:
                if user.login.endswith(user_domain_filter):
                    all_users.append(
                        {
                            "id": user.id,
                            "login": user.login,
                            "name": user.name,
                        }
                    )

            offset += limit

        logger.info(
            f"Found {len(all_users)} Box users with domain '{user_domain_filter}'."
        )
    except Exception as e:
        logger.error(f"Error listing Box enterprise users: {e}")
        raise

    return all_users


def delete_box_user(
    client: Client, user_id: str, force: bool = True
) -> bool:
    """
    Delete a specific user from the Box enterprise.

    Args:
        client: Authenticated Box SDK client.
        user_id: The Box user ID to delete.
        force: If True, the user will be deleted even if they still own content.
               Their content will be moved to the admin's trash.

    Returns:
        True if deletion was successful, False otherwise.
    """
    try:
        user = client.user(user_id=user_id)
        user.delete(force=force)
        logger.info(f"Successfully deleted Box user {user_id}.")
        return True
    except Exception as e:
        logger.error(f"Failed to delete Box user {user_id}: {e}")
        return False
