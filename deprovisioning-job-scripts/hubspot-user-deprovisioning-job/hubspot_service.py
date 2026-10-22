"""
HubSpot API client for the deprovisioning nightly job.

Uses the HubSpot Settings API v3 with a Private App access token
to list and delete users in the HubSpot portal.
"""

import os
from typing import List, Optional

import requests
from loguru import logger

from shared_lib.utils import get_secret_value


# Domain filter for users eligible for deprovisioning
DEMOSPACE_USER_DOMAIN = "@demospace.altostrat.com"

# HubSpot API base URL
HUBSPOT_API_BASE = "https://api.hubapi.com"


def setup_hubspot_client() -> dict:
    """
    Initialize HubSpot auth by retrieving the Private App access token
    from Secret Manager.

    Required environment variables:
        - GCP_PROJECT_ID: Google Cloud project ID
        - HUBSPOT_ACCESS_TOKEN_SECRET_NAME: Secret name for HubSpot access token

    Returns:
        A dict containing the access token and headers for API calls.
    """
    project_id = os.getenv("GCP_PROJECT_ID")
    if not project_id:
        raise ValueError("GCP_PROJECT_ID environment variable is not set.")

    access_token = get_secret_value(
        project_id, os.getenv("HUBSPOT_ACCESS_TOKEN_SECRET_NAME")
    )

    if not access_token:
        raise ValueError(
            "Failed to retrieve HubSpot access token from Secret Manager."
        )

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    logger.info("HubSpot client initialized successfully.")
    return {"access_token": access_token, "headers": headers}


def list_hubspot_users(
    client: dict,
    user_domain_filter: str = DEMOSPACE_USER_DOMAIN,
) -> List[dict]:
    """
    List all users in the HubSpot portal, filtered to a specific domain.

    Args:
        client: Dict containing 'headers' for API auth.
        user_domain_filter: Only return users whose email ends with this domain.

    Returns:
        List of dicts with 'id', 'email' for each matching user.
    """
    all_users = []
    offset = 0
    limit = 100

    try:
        while True:
            params = {"limit": limit, "offset": offset}
            resp = requests.get(
                f"{HUBSPOT_API_BASE}/settings/v3/users",
                headers=client["headers"],
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])

            if not results:
                break

            for user in results:
                email = user.get("email", "")
                if email.endswith(user_domain_filter):
                    all_users.append(
                        {
                            "id": user.get("id"),
                            "email": email,
                        }
                    )

            # Check for pagination
            paging = data.get("paging", {})
            next_page = paging.get("next", {})
            if next_page.get("after"):
                offset += limit
            else:
                break

        logger.info(
            f"Found {len(all_users)} HubSpot users with domain "
            f"'{user_domain_filter}'."
        )
    except Exception as e:
        logger.error(f"Error listing HubSpot users: {e}")
        raise

    return all_users


def delete_hubspot_user(client: dict, user_id: str) -> bool:
    """
    Delete a specific user from the HubSpot portal.

    Args:
        client: Dict containing 'headers' for API auth.
        user_id: The HubSpot user ID to delete.

    Returns:
        True if deletion was successful, False otherwise.
    """
    try:
        resp = requests.delete(
            f"{HUBSPOT_API_BASE}/settings/v3/users/{user_id}",
            headers=client["headers"],
            timeout=30,
        )
        if resp.status_code == 204:
            logger.info(f"Successfully deleted HubSpot user {user_id}.")
            return True
        resp.raise_for_status()
        return True
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            logger.warning(
                f"HubSpot user {user_id} not found (already deleted?)."
            )
            return True
        logger.error(f"Failed to delete HubSpot user {user_id}: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to delete HubSpot user {user_id}: {e}")
        return False
