from fastapi import Header, HTTPException
from google.cloud.secretmanager_v1 import SecretManagerServiceClient
from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker

from ..common.constants import (
    GCP_PROJECT_ID,
    DB_HOST,
    DB_NAME,
    DB_PORT,
    DB_USER,
    DB_PASSWORD_SECRET_NAME,
)
from ..common.models import AppConfig
from ..utils.logging import logger


def get_secret_password():
    """Retrieves the database password from Secret Manager."""
    project_id = GCP_PROJECT_ID
    secret_name = DB_PASSWORD_SECRET_NAME
    secret_version_name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
    try:
        client = SecretManagerServiceClient()
        response = client.access_secret_version(name=secret_version_name)
        payload = response.payload.data.decode("UTF-8")
        return payload
    except Exception as e:
        logger.error(f"Error occurred while accessing secret: {e}")
        return None


def setup_database_session():
    db_url = URL.create(
        drivername="postgresql+psycopg2",
        username=DB_USER,
        password=get_secret_password(),
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
    )
    engine = create_engine(db_url)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return session


SessionLocal = setup_database_session()


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


app_config = {}


def get_app_config():
    """Dependency to fetch application configuration from database."""
    global app_config
    if not app_config:
        with SessionLocal() as db:
            configs = db.query(AppConfig).all()
            app_config = {config.key: config.value for config in configs}
    return app_config


def refresh_app_config():
    """Clear the cached application configuration."""
    global app_config
    app_config = {}
    get_app_config()
