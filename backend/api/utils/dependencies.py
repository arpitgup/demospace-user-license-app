import os

from fastapi import Header, HTTPException
from google.cloud.secretmanager_v1 import SecretManagerServiceClient
from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker

from ..common.constants import DB_PASSWORD_SECRET_NAME, GCP_PROJECT_ID
from ..common.models import AppConfig
from ..utils.logging import logger


def get_secret_password():
    """Retrieves the database password from Secret Manager."""
    project_id = os.getenv("GCP_PROJECT_ID")
    secret_name = os.getenv("DB_PASSWORD_SECRET_NAME")
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
    db_user = os.environ.get("DB_USER")
    db_password = get_secret_password()
    db_host = os.environ.get("DB_HOST")
    db_port = os.environ.get("DB_PORT", 5432)
    db_name = os.environ.get("DB_NAME")

    db_url = URL.create(
        drivername="postgresql+psycopg2",
        username=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        database=db_name,
    )
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
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


async def get_user_email(x_google_user_email: str = Header(...)):
    """Dependency to get the custom user email header."""
    if not x_google_user_email:
        raise HTTPException(status_code=400, detail="Missing X-Google-User-Email")
    return x_google_user_email


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
