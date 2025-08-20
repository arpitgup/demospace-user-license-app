import pytest
import json

from datetime import timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from shared_lib.db.models import (
    AppConfig,
    Base,
    Application,
    Bot,
    BotApplication,
)
from shared_lib.dependencies import get_db, get_user_email, get_app_config


TEST_USER = "test-user@example.com"
UTC = timezone.utc


# --- Test Database Setup ---
# In-memory SQLite database for testing to ensure tests are isolated
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- Test Fixtures ---
@pytest.fixture(scope="function")
def db_session():
    """
    Pytest fixture to create a new database session for each test.
    It creates all tables, yields the session, and then drops all tables after the test.
    """
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def mock_background_tasks_add_task():
    with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
        yield mock_add_task


@pytest.fixture(scope="function", autouse=True)
def seed_data(db_session):
    """
    Pytest fixture to seed the test database with initial data.
    """
    # Create Applications
    app1 = Application(id=1, name="Jira")
    app2 = Application(id=2, name="Slack")
    app3 = Application(id=3, name="Salesforce")
    app4 = Application(id=4, name="Box")
    db_session.add_all([app1, app2, app3, app4])

    # Create Bots
    bot1 = Bot(id=101, name="BotA", email="bota@example.com")
    bot2 = Bot(id=102, name="BotB", email="botb@example.com")
    db_session.add_all([bot1, bot2])

    # Link bots to applications
    # BotA supports Jira, Slack, Salesforce
    # BotB supports Salesforce and Box
    bot_app1 = BotApplication(bot_id=101, application_id=1)
    bot_app2 = BotApplication(bot_id=101, application_id=2)
    bot_app3 = BotApplication(bot_id=101, application_id=3)
    bot_app4 = BotApplication(bot_id=102, application_id=3)
    bot_app5 = BotApplication(bot_id=102, application_id=4)
    db_session.add_all([bot_app1, bot_app2, bot_app3, bot_app4, bot_app5])

    db_session.commit()
    return {"apps": [app1, app2, app3, app4], "bots": [bot1, bot2]}


@pytest.fixture(scope="function")
def app(db_session):
    """
    Fixture to create a FastAPI app instance for testing, with Google Cloud services mocked.
    """
    dummy_service_account_info = {
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test_key_id",
        "private_key": "-----BEGIN PRIVATE KEY-----\nVEVTVF9LRVk=\n-----END PRIVATE KEY-----\n",
        "client_email": "test@example.com",
        "client_id": "12345",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40example.com",
    }

    mock_credentials = MagicMock()

    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    def override_get_user_email():
        return TEST_USER

    def override_get_app_config():
        return {
            "maxReservationApplications": 3,
            "maxCalendarDays": 30,
            "maxSlotsToFind": 3,
            "rollingWindowHours": 1,
            "reservationLeadDays": 7,
            "unavailableReservationDays": 7,
        }

    with patch(
        "shared_lib.utils.get_secret_value",
        return_value=json.dumps(dummy_service_account_info),
    ), patch(
        "google.oauth2.service_account.Credentials.from_service_account_info",
        return_value=mock_credentials,
    ), patch(
        "googleapiclient.discovery.build"
    ) as mock_build:
        mock_build.return_value = MagicMock()
        from app.main import app as fastapi_app

        # Remove the UserValidationMiddleware for testing
        fastapi_app.user_middleware = [
            m
            for m in fastapi_app.user_middleware
            if m.cls.__name__
            not in ["UserValidationMiddleware", "AdminValidationMiddleware"]
        ]
        fastapi_app.middleware_stack = fastapi_app.build_middleware_stack()
        fastapi_app.dependency_overrides[get_db] = override_get_db
        fastapi_app.dependency_overrides[get_user_email] = override_get_user_email
        fastapi_app.dependency_overrides[get_app_config] = override_get_app_config

        yield fastapi_app


@pytest.fixture(scope="function")
def test_client(app):
    """
    Fixture to create a TestClient for the app.
    """
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
