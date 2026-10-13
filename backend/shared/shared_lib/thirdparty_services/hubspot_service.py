"""
HubSpot Settings API client for user provisioning and deprovisioning.

Uses the HubSpot Settings API v3 (/settings/v3/users and /settings/v3/teams)
to manage portal users for the Agentspace demo environment.

Provisioning flow:
  1. Check if user already exists (by email).
  2. If not present → create user and add to team.
  3. If present → ensure they are added to the team.

Deprovisioning flow:
  1. Remove user from the team.
  2. Delete the user from the HubSpot portal.

NOTE: The HubSpot API does not expose activate/deactivate toggles.
      Deleting the user is the closest API-level equivalent to deactivation.
"""

import os
from typing import Optional

import requests
from loguru import logger

from shared_lib.utils import get_secret_value


# HubSpot API base URL
HUBSPOT_API_BASE = "https://api.hubapi.com"

# HubSpot team ID users are added to during provisioning
HUBSPOT_DEMO_TEAM_ID = os.getenv("HUBSPOT_DEMO_TEAM_ID", "Universal_Demo_User_Team")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_access_token() -> str:
    """
    Retrieves the HubSpot Private App access token from GCP Secret Manager.

    Required environment variables:
        - GCP_PROJECT_ID: GCP project containing the secrets.
        - HUBSPOT_ACCESS_TOKEN_SECRET_NAME: Secret Manager secret name for the
          HubSpot private app access token.
    """
    project_id = os.getenv("GCP_PROJECT_ID")
    secret_name = os.getenv("HUBSPOT_ACCESS_TOKEN_SECRET_NAME")

    if not project_id or not secret_name:
        raise ValueError(
            "GCP_PROJECT_ID and HUBSPOT_ACCESS_TOKEN_SECRET_NAME "
            "environment variables must be set."
        )

    token = get_secret_value(project_id, secret_name)
    if not token:
        raise ValueError(
            "Failed to retrieve HubSpot access token from Secret Manager."
        )
    return token


# Lazy-initialized access token singleton
_access_token: Optional[str] = None


def _get_headers() -> dict:
    """Returns authorization headers for HubSpot API requests."""
    global _access_token
    if _access_token is None:
        _access_token = _get_access_token()
    return {
        "Authorization": f"Bearer {_access_token}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# User lookup helpers
# ---------------------------------------------------------------------------

def get_hubspot_user_by_email(user_email: str) -> Optional[dict]:
    """
    Looks up a HubSpot user by email.

    Iterates through paginated results from GET /settings/v3/users
    to find a user whose email matches.

    Returns:
        The user dict (containing 'id', 'email', etc.) if found, else None.
    """
    headers = _get_headers()
    url = f"{HUBSPOT_API_BASE}/settings/v3/users"
    offset = 0
    limit = 100

    try:
        while True:
            params = {"limit": limit, "offset": offset}
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])

            for user in results:
                if user.get("email", "").lower() == user_email.lower():
                    logger.info(
                        f"[HubSpot] Found existing user for {user_email} "
                        f"(ID: {user.get('id')})."
                    )
                    return user

            # Check for pagination
            paging = data.get("paging", {})
            next_page = paging.get("next", {})
            if next_page.get("after"):
                offset += limit
            else:
                break

        logger.info(f"[HubSpot] No existing user found for {user_email}.")
        return None

    except requests.exceptions.HTTPError as e:
        logger.error(f"[HubSpot] HTTP error looking up user {user_email}: {e}")
        raise
    except Exception as e:
        logger.error(f"[HubSpot] Error looking up user {user_email}: {e}")
        raise


def _create_hubspot_user(user_email: str) -> dict:
    """
    Creates a new user in the HubSpot portal.

    Args:
        user_email: The email address for the new user.

    Returns:
        The created user dict from the API response.
    """
    headers = _get_headers()
    url = f"{HUBSPOT_API_BASE}/settings/v3/users"
    payload = {
        "email": user_email,
        "sendWelcomeEmail": False,
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        user = resp.json()
        logger.info(
            f"[HubSpot] Successfully created user {user_email} "
            f"(ID: {user.get('id')})."
        )
        return user
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 409:
            logger.warning(
                f"[HubSpot] User {user_email} already exists (conflict). "
                "Attempting lookup."
            )
            existing = get_hubspot_user_by_email(user_email)
            if existing:
                return existing
        logger.error(f"[HubSpot] HTTP error creating user {user_email}: {e}")
        raise
    except Exception as e:
        logger.error(f"[HubSpot] Error creating user {user_email}: {e}")
        raise


def _delete_hubspot_user(user_id: str) -> bool:
    """
    Permanently deletes a user from the HubSpot portal.

    Args:
        user_id: The HubSpot internal user ID.

    Returns:
        True if deletion was successful, False otherwise.
    """
    headers = _get_headers()
    url = f"{HUBSPOT_API_BASE}/settings/v3/users/{user_id}"

    try:
        resp = requests.delete(url, headers=headers, timeout=30)
        if resp.status_code == 204:
            logger.info(f"[HubSpot] Successfully deleted user ID {user_id}.")
            return True
        resp.raise_for_status()
        return True
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            logger.warning(
                f"[HubSpot] User ID {user_id} not found (already deleted?)."
            )
            return True
        logger.error(f"[HubSpot] HTTP error deleting user ID {user_id}: {e}")
        return False
    except Exception as e:
        logger.error(f"[HubSpot] Error deleting user ID {user_id}: {e}")
        return False


# ---------------------------------------------------------------------------
# Team helpers
# ---------------------------------------------------------------------------

def _add_user_to_team(user_id: str, team_id: str) -> None:
    """
    Adds a user to a HubSpot team by updating their primaryTeamId.

    Uses PUT /settings/v3/users/{userId} to set the user's team.
    """
    headers = _get_headers()
    url = f"{HUBSPOT_API_BASE}/settings/v3/users/{user_id}"
    payload = {
        "primaryTeamId": team_id,
    }

    try:
        resp = requests.put(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        logger.info(
            f"[HubSpot] Added user ID {user_id} to team {team_id}."
        )
    except requests.exceptions.HTTPError as e:
        logger.error(
            f"[HubSpot] HTTP error adding user ID {user_id} to team "
            f"{team_id}: {e}"
        )
        raise
    except Exception as e:
        logger.error(
            f"[HubSpot] Error adding user ID {user_id} to team {team_id}: {e}"
        )
        raise


def _remove_user_from_team(user_id: str, team_id: str) -> None:
    """
    Removes a user from a HubSpot team.

    Attempts to remove via DELETE /settings/v3/users/{userId} team update.
    Since the HubSpot API doesn't have a direct 'remove from team' for primary
    teams, we clear the primaryTeamId by updating the user.
    """
    headers = _get_headers()
    url = f"{HUBSPOT_API_BASE}/settings/v3/users/{user_id}"

    # Setting primaryTeamId to None / removing it by updating user
    payload = {
        "primaryTeamId": None,
    }

    try:
        resp = requests.put(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        logger.info(
            f"[HubSpot] Removed user ID {user_id} from team {team_id}."
        )
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            logger.warning(
                f"[HubSpot] User ID {user_id} not found when removing "
                f"from team {team_id}."
            )
            return
        logger.error(
            f"[HubSpot] HTTP error removing user ID {user_id} from team "
            f"{team_id}: {e}"
        )
        raise
    except Exception as e:
        logger.error(
            f"[HubSpot] Error removing user ID {user_id} from team "
            f"{team_id}: {e}"
        )
        raise


# ---------------------------------------------------------------------------
# Provision / Deprovision — public API
# ---------------------------------------------------------------------------

def provision_hubspot_user(user_email: str, user_name: str = "") -> dict:
    """
    Provisions a user in HubSpot and adds them to the demo team.

    - If user exists → adds to team.
    - If no user exists → creates user, then adds to team.

    Args:
        user_email: The email address for the user.
        user_name: Display name (unused by HubSpot create API but kept for
                   interface consistency with box_service).

    Returns:
        The HubSpot user dict.
    """
    team_id = HUBSPOT_DEMO_TEAM_ID
    if not team_id:
        logger.warning(
            "[HubSpot] HUBSPOT_DEMO_TEAM_ID is not set. "
            "Skipping team assignment."
        )

    try:
        existing_user = get_hubspot_user_by_email(user_email)

        if existing_user:
            user_id = existing_user["id"]
            logger.info(
                f"[HubSpot] User {user_email} already exists "
                f"(ID: {user_id}). Ensuring team membership."
            )
            if team_id:
                _add_user_to_team(user_id, team_id)
            return existing_user

        # Create new user
        new_user = _create_hubspot_user(user_email)
        user_id = new_user["id"]
        if team_id:
            _add_user_to_team(user_id, team_id)
        return new_user

    except Exception as e:
        logger.error(
            f"[HubSpot] Unexpected error provisioning user {user_email}: {e}"
        )
        raise


def deprovision_hubspot_user(user_email: str) -> None:
    """
    Deprovisions a HubSpot user by removing them from the demo team
    and deleting them from the portal.

    Args:
        user_email: The email address of the HubSpot user to deprovision.
    """
    team_id = HUBSPOT_DEMO_TEAM_ID

    try:
        existing_user = get_hubspot_user_by_email(user_email)
        if not existing_user:
            logger.warning(
                f"[HubSpot] Cannot deprovision user {user_email}: "
                "user not found."
            )
            return

        user_id = existing_user["id"]

        # Remove from team first
        if team_id:
            _remove_user_from_team(user_id, team_id)

        # Delete the user
        logger.info(
            f"[HubSpot] Deleting user {user_email} (ID: {user_id})."
        )
        _delete_hubspot_user(user_id)
        logger.info(
            f"[HubSpot] Successfully deprovisioned user {user_email}."
        )

    except Exception as e:
        logger.error(
            f"[HubSpot] Unexpected error deprovisioning user "
            f"{user_email}: {e}"
        )
        raise
