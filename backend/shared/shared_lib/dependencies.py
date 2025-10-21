from fastapi import Header, HTTPException

from .db.models import AppConfig
from .db.session import SessionLocal


def get_db():
    """Dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_user_email(x_demo_user_email: str = Header(...)):
    """Dependency to get the custom user email header."""
    if not x_demo_user_email:
        raise HTTPException(status_code=400, detail="Missing X-Demo-User-Email")
    return x_demo_user_email

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

async def get_authenticated_iap_user_email(x_goog_authenticated_user_email: str = Header(...)):
    """Dependency to get user email from IAP's header value."""
    if not x_goog_authenticated_user_email:
        raise HTTPException(status_code=400, detail="Missing X-Goog-Authenticated-User-Email header")
    return x_goog_authenticated_user_email

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
