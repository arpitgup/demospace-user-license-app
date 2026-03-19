from fastapi import Header, HTTPException, Depends
from .admin_service import get_user, rebrand_user_email
from .db.models import AppConfig
from .db.session import SessionLocal
from .constants import DEMOSPACE_ADMIN_DOMAIN, DEMOSPACE_USER_DOMAIN, LEGACY_DEMOUSER_EMAIL_SUFFIX
import requests
import time
import sys
from typing import Dict, Any, Optional
from functools import lru_cache
from loguru import logger

def get_db():
    """Dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_user_email(X_Goog_Authenticated_User_Email: str = Header(...)):
    """Dependency to get the custom user email header."""
    if not X_Goog_Authenticated_User_Email:
        raise HTTPException(status_code=400, detail="Missing X-Goog-Authenticated-User-Email")
    
    # If User with 'ldap-dev@demospace.altostrat.com' are accessing the App will redirect to Admin Panel.
    # If they are member of 'agentspace-license-app-admin@1987984870407.altostrat.com' then they will have Admin Access.
    if DEMOSPACE_ADMIN_DOMAIN in X_Goog_Authenticated_User_Email:
        admin_user_email = construct_admin_user_email(X_Goog_Authenticated_User_Email)
        return admin_user_email
    
    # Extract LDAP for google.com users
    try:
        ldap = X_Goog_Authenticated_User_Email.split(':')[1].split('@')[0]
    except (IndexError, AttributeError):
        logger.error(f"Invalid input format for user email header: {X_Goog_Authenticated_User_Email}")
        raise HTTPException(status_code=400, detail="Invalid X-Goog-Authenticated-User-Email format")

    legacy_demouser_email = f"{ldap}{LEGACY_DEMOUSER_EMAIL_SUFFIX}"
    new_demouser_email = f"{ldap}{DEMOSPACE_USER_DOMAIN}"
    
    # Check if user exists with old format.
    # If yes and it's the primary email, then Rename the primary email with new domain.
    # If it's an alias, then rebranding is already done.
    user = get_user(legacy_demouser_email)
    if user and user.get("primaryEmail") == legacy_demouser_email:
        # Update the user's email rebranding
        rebrand_user_email(legacy_demouser_email, new_demouser_email)
        logger.info(f"User {legacy_demouser_email} found with old format. Rebranded to {new_demouser_email}.")
        return new_demouser_email
    
    logger.info(f"Passing new identity format for LDAP {ldap}: {new_demouser_email}")
    return new_demouser_email

# This is only being used by '/me' API in main.py
async def get_iap_authenticated_user_email(X_Goog_Authenticated_User_Email: str =  Header(...)):
    """Dependency to get the original authenticated IAP user email header."""
    if not X_Goog_Authenticated_User_Email:
        raise HTTPException(status_code=400, detail="Missing X-Goog-Authenticated-User-Email")
    demouser_iap_email = construct_iap_authenticated_user_email(X_Goog_Authenticated_User_Email)
    return demouser_iap_email


# Now we are directly constructing inside get_user_email function.
# def construct_demouser_email(user_email_input):
#     """
#     Takes an input like 'accounts.google.com:ldap@google.com',
#     extracts the LDAP (username), and returns a new demo email address.
#     """
#     try:
#         ldap = user_email_input.split(':')[1].split('@')[0]
#         demouser_email = f"{ldap}{DEMOSPACE_DOMAIN}"
#         return demouser_email
#     except IndexError:
#         return "Invalid input format. Expected 'provider:user@domain.com'"

def construct_admin_user_email(user_email_input):
    """
    Takes an input like 'accounts.altostrat.com:ldap-dev@demospace.altostrat.com',
    returns the email address.
    """
    try:
        admin_user_email = user_email_input.split(':', 1)[1]
        return admin_user_email
    except IndexError:
        return "Invalid input format. Expected 'provider:user@domain.com'"

def construct_iap_authenticated_user_email(header_input):
    """
    Get usereail from X_Goog_Authenticated_User_Email header.
    """
    try:
        iap_user_email = header_input.split(':', 1)[1]
        return iap_user_email
    except IndexError:
        return "Invalid input format. Expected 'provider:user@domain.com'"


async def get_user_current_time(x_user_current_time: str = Header(...)):
    """Dependency to get the custom user current time header."""
    if not x_user_current_time:
        raise HTTPException(status_code=400, detail="Missing X-User-Current-Time")
    return x_user_current_time

async def get_user_token(x_user_token: str = Header(...)):
    """Dependency to get the custom user token header."""
    if not x_user_token:
        raise HTTPException(status_code=400, detail="Missing X-User-Current-Time")
    return x_user_token

app_config = {}

def get_app_config():
    """Dependency to fetch application configuration from database."""
    global app_config
    if not app_config:
        app_config = {}
        with SessionLocal() as db:
            configs = db.query(AppConfig).all()
            for config in configs:
                app_config[config.key] = (
                    int(config.value) if config.value.isdigit() else config.value
                )
    return app_config


def refresh_app_config():
    """Clear the cached application configuration."""
    global app_config
    app_config = {}
    get_app_config()