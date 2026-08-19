import os

from boxsdk import CCGAuth, Client
from boxsdk.exception import BoxAPIException
from loguru import logger

from .utils import get_secret_value


# The Box group users are added to during provisioning
BOX_UNIVERSAL_DEMO_USER_GROUP_ID = "28386654218"


def setup_box_client():
    """
    Sets up the Box client using Client Credentials Grant (CCG) authentication.

    Required environment variables:
        - GCP_PROJECT_ID: GCP project containing the secrets.
        - BOX_CLIENT_ID_SECRET_NAME: Secret Manager secret name for the Box Client ID.
        - BOX_CLIENT_SECRET_SECRET_NAME: Secret Manager secret name for the Box Client Secret.
        - BOX_ENTERPRISE_ID_SECRET_NAME: Secret Manager secret name for the Box Enterprise ID.
    """
    project_id = os.getenv("GCP_PROJECT_ID")
    box_client_id_secret = os.getenv("BOX_CLIENT_ID_SECRET_NAME")
    box_client_secret_secret = os.getenv("BOX_CLIENT_SECRET_SECRET_NAME")
    box_enterprise_id_secret = os.getenv("BOX_ENTERPRISE_ID_SECRET_NAME")

    box_client_id = get_secret_value(project_id, box_client_id_secret)
    box_client_secret = get_secret_value(project_id, box_client_secret_secret)
    box_enterprise_id = get_secret_value(project_id, box_enterprise_id_secret)

    if not all([box_client_id, box_client_secret, box_enterprise_id]):
        logger.error(
            "Box client configuration is incomplete. "
            "Ensure BOX_CLIENT_ID_SECRET_NAME, BOX_CLIENT_SECRET_SECRET_NAME, "
            "and BOX_ENTERPRISE_ID_SECRET_NAME environment variables are set correctly."
        )
        raise ValueError("Incomplete Box client configuration.")

    auth = CCGAuth(
        client_id=box_client_id,
        client_secret=box_client_secret,
        enterprise_id=box_enterprise_id,
    )
    return Client(auth)


# Lazy-initialized Box client singleton
_box_client = None


def _get_box_client():
    """Returns a lazily-initialized Box client singleton."""
    global _box_client
    if _box_client is None:
        _box_client = setup_box_client()
    return _box_client


# ---------------------------------------------------------------------------
# Group helpers
# ---------------------------------------------------------------------------

def _get_demo_group():
    """
    Returns the Box demo group object by its ID.
    """
    client = _get_box_client()
    try:
        group = client.group(group_id=BOX_UNIVERSAL_DEMO_USER_GROUP_ID).get()
        logger.info(f"[Box] Found group '{group.name}' (ID: {group.id}).")
        return group
    except BoxAPIException as e:
        logger.error(f"[Box] Error looking up group ID '{BOX_UNIVERSAL_DEMO_USER_GROUP_ID}': {e}")
        return None


def _add_user_to_group(user, group):
    """
    Adds a Box user to a Box group.
    Handles 409 Conflict gracefully if the user is already a member.
    """
    try:
        group.add_member(user)
        logger.info(f"[Box] Added user {user.login} to group '{group.name}'.")
    except BoxAPIException as e:
        if e.status == 409:
            logger.info(f"[Box] User {user.login} is already a member of group '{group.name}'.")
        else:
            logger.error(f"[Box] Error adding user {user.login} to group '{group.name}': {e}")
            raise


def _remove_user_from_group(user, group):
    """
    Removes a Box user from a Box group by finding and deleting their membership.
    """
    try:
        memberships = group.get_memberships()
        for membership in memberships:
            if membership.user["id"] == user.id:
                membership.delete()
                logger.info(f"[Box] Removed user {user.login} from group '{group.name}'.")
                return
        logger.info(f"[Box] User {user.login} is not a member of group '{group.name}'. No action needed.")
    except BoxAPIException as e:
        logger.error(f"[Box] Error removing user {user.login} from group '{group.name}': {e}")
        raise


# ---------------------------------------------------------------------------
# Provision / Deprovision
# ---------------------------------------------------------------------------

def get_box_user_by_email(user_email: str):
    """
    Looks up a Box managed user by their login email.

    Returns the Box user object if found, None otherwise.
    """
    client = _get_box_client()
    try:
        users = client.users(filter_term=user_email, user_type="managed")
        for user in users:
            if user.login == user_email:
                logger.info(f"Found existing Box user for {user_email} (ID: {user.id}).")
                return user
        logger.info(f"No existing Box user found for {user_email}.")
        return None
    except BoxAPIException as e:
        logger.error(f"Box API error while looking up user {user_email}: {e}")
        raise


def provision_box_user(user_email: str, user_name: str):
    """
    Provisions a managed user in Box and adds them to the demo group.

    - If user exists and is inactive → reactivates and adds to group.
    - If user exists and is active → ensures group membership.
    - If no user exists → creates and adds to group.

    Args:
        user_email: The email/login for the new Box user (matches reservation.user_email).
        user_name: The display name for the Box user.
    """
    client = _get_box_client()
    try:
        # Check if the user already exists
        existing_user = get_box_user_by_email(user_email)
        if existing_user:
            # If the user exists but is inactive, reactivate them
            if existing_user.status == "inactive":
                logger.info(f"Reactivating inactive Box user {user_email} (ID: {existing_user.id}).")
                updated_user = existing_user.update_info(data={"status": "active"})
                logger.info(f"Successfully reactivated Box user {user_email}.")
                _ensure_group_membership(updated_user)
                return updated_user
            else:
                logger.info(f"Box user {user_email} already exists and is active (ID: {existing_user.id}).")
                _ensure_group_membership(existing_user)
                return existing_user

        # Create a new managed user
        logger.info(f"Creating new Box managed user: {user_email}.")
        new_user = client.create_user(name=user_name, login=user_email)
        logger.info(f"Successfully created Box user {user_email} (ID: {new_user.id}).")
        _ensure_group_membership(new_user)
        return new_user

    except BoxAPIException as e:
        if e.status == 409:
            logger.warning(f"Box user {user_email} already exists (conflict).")
            return get_box_user_by_email(user_email)
        logger.error(f"Box API error while provisioning user {user_email}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error while provisioning Box user {user_email}: {e}")
        raise


def _ensure_group_membership(user):
    """Adds the user to the demo group."""
    group = _get_demo_group()
    if group:
        _add_user_to_group(user, group)
    else:
        logger.warning(f"[Box] Skipping group assignment — group ID '{BOX_UNIVERSAL_DEMO_USER_GROUP_ID}' not found.")


def deprovision_box_user(user_email: str):
    """
    Deprovisions a Box user by removing them from the demo group
    and setting their status to 'inactive'.

    This does NOT delete the user — it only deactivates them,
    preserving their data and content in Box.

    Args:
        user_email: The email/login of the Box user to deactivate.
    """
    try:
        existing_user = get_box_user_by_email(user_email)
        if not existing_user:
            logger.warning(f"Cannot deprovision Box user {user_email}: user not found.")
            return

        # Remove from demo group first
        group = _get_demo_group()
        if group:
            _remove_user_from_group(existing_user, group)

        if existing_user.status == "inactive":
            logger.info(f"Box user {user_email} is already inactive. No action needed.")
            return

        logger.info(f"Deactivating Box user {user_email} (ID: {existing_user.id}).")
        existing_user.update_info(data={"status": "inactive"})
        logger.info(f"Successfully deactivated Box user {user_email}.")

    except BoxAPIException as e:
        logger.error(f"Box API error while deprovisioning user {user_email}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error while deprovisioning Box user {user_email}: {e}")
        raise
