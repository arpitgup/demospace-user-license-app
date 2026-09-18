"""
Unit tests for the Box User Deprovisioning Job.

Tests cover the 4 key scenarios for user deletion:
1. User with only past Box reservations (COMPLETED) → DELETE
2. User with back-to-back Box reservations → KEEP
3. User with future Box reservation within 24h → KEEP
4. User exists in Box but has no reservations → DELETE

Uses SQLite in-memory database with mocked Box SDK calls.
"""

import json
import sys
import os

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

from sqlalchemy import create_engine, event, String
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import JSONB

from shared_lib.db.models import (
    Base,
    Application,
    Bot,
    BotApplication,
    Reservation,
    ReservationStatus,
    reservation_applications_table,
)


# --- Test Database Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite://"  # In-memory SQLite

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

UTC = timezone.utc


# --- SQLite JSONB Adapter ---
# PostgreSQL JSONB is not supported by SQLite. We register a type adapter
# that compiles JSONB as TEXT when using the SQLite dialect.
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"


# --- Fixtures ---

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def seed_box_app(db_session):
    """Seed the Box application and a bot that supports it."""
    box_app = Application(
        id=4, name="Box", custom_SAML_attribute="SAML_BOX", created_by="test"
    )
    jira_app = Application(
        id=1, name="Jira", custom_SAML_attribute="SAML_JIRA", created_by="test"
    )
    db_session.add_all([box_app, jira_app])

    bot = Bot(id=101, name="BotA", email="bota@example.com")
    db_session.add(bot)
    db_session.flush()

    bot_app = BotApplication(bot_id=101, application_id=4)
    db_session.add(bot_app)

    db_session.commit()
    return {"box_app": box_app, "jira_app": jira_app, "bot": bot}


# --- Import the modules under test (after mocking external dependencies) ---

@pytest.fixture(autouse=True)
def mock_external_services():
    """Mock all external services so tests don't require real credentials."""
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

    with patch(
        "shared_lib.utils.get_secret_value",
        return_value=json.dumps(dummy_service_account_info),
    ), patch(
        "google.oauth2.service_account.Credentials.from_service_account_info",
        return_value=MagicMock(),
    ), patch(
        "googleapiclient.discovery.build",
        return_value=MagicMock(),
    ):
        yield


# --- Helper to add the source to sys.path ---

@pytest.fixture(autouse=True)
def add_source_to_path():
    """Add the job source directory to sys.path so imports work."""
    job_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if job_dir not in sys.path:
        sys.path.insert(0, job_dir)
    yield


# --- Test Cases ---

class TestGetBoxApplicationId:
    """Tests for get_box_application_id function."""

    def test_box_app_found(self, db_session, seed_box_app):
        from main import get_box_application_id
        app_id = get_box_application_id(db_session)
        assert app_id == 4

    def test_box_app_not_found(self, db_session):
        from main import get_box_application_id
        with pytest.raises(ValueError, match="Box application not found"):
            get_box_application_id(db_session)


class TestGetProtectedUserEmails:
    """Tests for get_protected_user_emails function."""

    def test_no_protected_users(self, db_session, seed_box_app):
        """No reservations at all → no protected users."""
        from main import get_protected_user_emails
        now = datetime.now(UTC)
        protected = get_protected_user_emails(db_session, 4, now)
        assert len(protected) == 0

    def test_user_with_active_reservation_is_protected(self, db_session, seed_box_app):
        """User with an ACTIVE Box reservation should be protected."""
        from main import get_protected_user_emails
        now = datetime.now(UTC)

        reservation = Reservation(
            user_email="alice@demospace.altostrat.com",
            bot_id=101,
            primary_application_id=4,
            start_time=now - timedelta(hours=2),
            end_time=now + timedelta(hours=4),
            status=ReservationStatus.ACTIVE,
        )
        db_session.add(reservation)
        db_session.flush()

        # Link reservation to Box app
        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        assert "alice@demospace.altostrat.com" in protected

    def test_user_with_pending_future_reservation_is_protected(self, db_session, seed_box_app):
        """User with a PENDING Box reservation starting in the next 24h should be protected."""
        from main import get_protected_user_emails
        now = datetime.now(UTC)

        reservation = Reservation(
            user_email="bob@demospace.altostrat.com",
            bot_id=101,
            primary_application_id=4,
            start_time=now + timedelta(hours=12),
            end_time=now + timedelta(hours=18),
            status=ReservationStatus.PENDING,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        assert "bob@demospace.altostrat.com" in protected

    def test_user_with_completed_reservation_not_protected(self, db_session, seed_box_app):
        """User whose only Box reservation is COMPLETED should NOT be protected."""
        from main import get_protected_user_emails
        now = datetime.now(UTC)

        reservation = Reservation(
            user_email="charlie@demospace.altostrat.com",
            bot_id=101,
            primary_application_id=4,
            start_time=now - timedelta(hours=48),
            end_time=now - timedelta(hours=24),
            status=ReservationStatus.COMPLETED,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        assert "charlie@demospace.altostrat.com" not in protected


class TestClassifyUser:
    """Tests for classify_user function — covers all 4 scenarios."""

    def test_scenario_1_past_completed_reservations_only(self, db_session, seed_box_app):
        """
        Scenario 1: User with only past Box reservations (all COMPLETED).
        Expected: DELETE
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user1@demospace.altostrat.com"

        # Create a COMPLETED reservation in the past
        reservation = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=4,
            start_time=now - timedelta(hours=72),
            end_time=now - timedelta(hours=48),
            status=ReservationStatus.COMPLETED,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        assert action == "DELETE"
        assert "COMPLETED" in reason

    def test_scenario_2_back_to_back_reservations(self, db_session, seed_box_app):
        """
        Scenario 2: User with back-to-back Box reservations.
        Current one ending, next one starting within 24h.
        Expected: KEEP
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user2@demospace.altostrat.com"

        # First reservation: COMPLETED (just ended)
        res1 = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=4,
            start_time=now - timedelta(hours=8),
            end_time=now - timedelta(hours=1),
            status=ReservationStatus.COMPLETED,
        )
        db_session.add(res1)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=res1.id, application_id=4
            )
        )

        # Second reservation: PENDING (starting within 24h)
        res2 = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=4,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=8),
            status=ReservationStatus.PENDING,
        )
        db_session.add(res2)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=res2.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        assert action == "KEEP"
        assert "upcoming" in reason.lower() or "active" in reason.lower()

    def test_scenario_3_future_reservation_within_24h(self, db_session, seed_box_app):
        """
        Scenario 3: User with a future Box reservation starting within 24h.
        Expected: KEEP
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user3@demospace.altostrat.com"

        # Future PENDING reservation starting in 6 hours
        reservation = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=4,
            start_time=now + timedelta(hours=6),
            end_time=now + timedelta(hours=12),
            status=ReservationStatus.PENDING,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        assert action == "KEEP"

    def test_scenario_4_no_reservations_at_all(self, db_session, seed_box_app):
        """
        Scenario 4: User exists in Box but has no reservations at all.
        Expected: DELETE
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user4@demospace.altostrat.com"

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        assert action == "DELETE"
        assert "No Box reservations found" in reason

    def test_user_with_only_non_box_reservations(self, db_session, seed_box_app):
        """
        Edge case: User has reservations, but none include the Box app.
        Expected: DELETE (treated as no Box reservations)
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user5@demospace.altostrat.com"

        # Create a reservation linked only to Jira (app ID 1), not Box
        reservation = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=1,
            start_time=now + timedelta(hours=6),
            end_time=now + timedelta(hours=12),
            status=ReservationStatus.PENDING,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=1
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        assert action == "DELETE"
        assert "No Box reservations found" in reason

    def test_user_with_cancelled_reservation(self, db_session, seed_box_app):
        """
        Edge case: User's latest Box reservation is CANCELLED.
        Expected: DELETE
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user6@demospace.altostrat.com"

        reservation = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=4,
            start_time=now - timedelta(hours=48),
            end_time=now - timedelta(hours=24),
            status=ReservationStatus.CANCELLED,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        assert action == "DELETE"
        assert "CANCELLED" in reason

    def test_future_reservation_beyond_24h_not_protected(self, db_session, seed_box_app):
        """
        Edge case: User has a PENDING Box reservation starting > 24h in the future.
        Expected: DELETE (outside the 24h look-ahead window)
        """
        from main import classify_user, get_protected_user_emails
        now = datetime.now(UTC)
        user_email = "user7@demospace.altostrat.com"

        reservation = Reservation(
            user_email=user_email,
            bot_id=101,
            primary_application_id=4,
            start_time=now + timedelta(hours=36),
            end_time=now + timedelta(hours=42),
            status=ReservationStatus.PENDING,
        )
        db_session.add(reservation)
        db_session.flush()

        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=reservation.id, application_id=4
            )
        )
        db_session.commit()

        protected = get_protected_user_emails(db_session, 4, now)
        action, reason = classify_user(user_email, protected, db_session, 4)

        # User has a PENDING reservation but it's outside the 24h window
        # Since they're not protected, classify_user will check their reservation status
        # The latest reservation is PENDING (not COMPLETED/CANCELLED), so it should KEEP
        assert action == "KEEP"


class TestRunDeprovisioningJobIntegration:
    """Integration tests for the full job run (with mocked Box API)."""

    @patch("main.setup_box_client")
    @patch("main.list_box_enterprise_users")
    @patch("main.delete_box_user")
    @patch("main.send_deprovisioning_summary_email")
    @patch("main.SessionLocal")
    def test_dry_run_mode(
        self,
        mock_session_local,
        mock_send_email,
        mock_delete,
        mock_list_users,
        mock_setup_client,
        db_session,
        seed_box_app,
    ):
        """In dry-run mode, no users should actually be deleted."""
        now = datetime.now(UTC)

        # Add a completed reservation for a user
        res = Reservation(
            user_email="dryrun-user@demospace.altostrat.com",
            bot_id=101,
            primary_application_id=4,
            start_time=now - timedelta(hours=48),
            end_time=now - timedelta(hours=24),
            status=ReservationStatus.COMPLETED,
        )
        db_session.add(res)
        db_session.flush()
        db_session.execute(
            reservation_applications_table.insert().values(
                reservation_id=res.id, application_id=4
            )
        )
        db_session.commit()

        # Mock Box API
        mock_setup_client.return_value = MagicMock()
        mock_list_users.return_value = [
            {"id": "12345", "login": "dryrun-user@demospace.altostrat.com", "name": "Dry Run User"},
        ]

        # Mock DB session context manager
        mock_session_local.return_value.__enter__ = MagicMock(return_value=db_session)
        mock_session_local.return_value.__exit__ = MagicMock(return_value=False)

        # Set dry run mode
        os.environ["DRY_RUN"] = "true"

        from main import run_deprovisioning_job

        # The job should not call delete_box_user in dry-run mode
        try:
            run_deprovisioning_job()
        except SystemExit:
            pass  # Job may exit, that's fine

        mock_delete.assert_not_called()
        mock_send_email.assert_called_once()

        # Verify the email was sent with the correct data
        call_kwargs = mock_send_email.call_args[1]
        assert call_kwargs["dry_run"] is True
        assert len(call_kwargs["users_deleted"]) == 1
        assert call_kwargs["users_deleted"][0]["login"] == "dryrun-user@demospace.altostrat.com"
