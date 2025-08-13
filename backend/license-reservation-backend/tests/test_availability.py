from datetime import datetime, timedelta
from shared_lib.db.models import (
    Reservation,
    ReservationStatus,
)
from shared_lib.dependencies import get_db, get_user_email

from .conftest import TEST_USER, UTC


def test_get_availability_by_application_no_conflicts(test_client):
    """Test finding available bots when there are no conflicting reservations."""
    request_data = {
        "applicationId": 1,  # Jira
        "startTime": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "durationHours": 2,
    }
    response = test_client.post("/availability/by-application", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data["requestedSlotAvailable"] is True
    available_slots = response.json()["nextAvailableSlots"]
    # Should return a single slot for the requested time
    assert len(available_slots) == 1
    slot = available_slots[0]
    # BotA supports Jira, so it should be in the list
    assert len(slot["availableBots"]) == 1
    bot_info = slot["availableBots"][0]
    assert bot_info["name"] == "BotA"
    # Since there are no conflicts, it should be available for all its supported apps
    assert len(bot_info["applications"]) == 3


def test_get_availability_partial_availability(test_client, seed_data, db_session):
    """Test partial availability: bot is busy with one app but free for others."""
    start = datetime.now(UTC) + timedelta(hours=2)
    end = start + timedelta(minutes=120)

    # Create a reservation for BotA for Slack
    slack_app = next(app for app in seed_data["apps"] if app.name == "Slack")
    reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=start,
        end_time=end,
        status=ReservationStatus.PENDING,
    )
    reservation.applications.append(slack_app)
    db_session.add(reservation)
    db_session.commit()

    # Request availability for Jira in the same slot
    request_data = {
        "applicationId": 1,  # Jira
        "startTime": start.isoformat(),
        "durationHours": 2,
    }
    response = test_client.post("/availability/by-application", json=request_data)

    assert response.status_code == 200
    available_slots = response.json()["nextAvailableSlots"]
    # Should still return the requested slot because BotA is partially available
    assert len(available_slots) == 1
    slot = available_slots[0]
    assert len(slot["availableBots"]) == 1
    bot_info = slot["availableBots"][0]
    assert bot_info["name"] == "BotA"
    # BotA should be available for Jira and Salesforce, but not Slack
    assert len(bot_info["applications"]) == 2
    app_names = {app["name"] for app in bot_info["applications"]}
    assert {"Jira", "Salesforce"} == app_names


def test_get_availability_suggests_next_slots(test_client, seed_data, db_session):
    """Test suggesting next slots when the requested application is unavailable."""
    start = datetime.now(UTC) + timedelta(hours=3)
    end = start + timedelta(hours=2)

    # Create a reservation for BotA for Jira (the requested app)
    jira_app = next(app for app in seed_data["apps"] if app.name == "Jira")
    reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=start,
        end_time=end,
        status=ReservationStatus.PENDING,
    )
    reservation.applications.append(jira_app)
    db_session.add(reservation)
    db_session.commit()

    # Request availability for Jira in the conflicting slot
    request_data = {
        "applicationId": 1,  # Jira
        "startTime": start.isoformat(),
        "durationHours": 2,
    }
    response = test_client.post("/availability/by-application", json=request_data)

    assert response.status_code == 200
    available_slots = response.json()["nextAvailableSlots"]
    # The response should be a list of future slots, not the requested one
    assert len(available_slots) > 0
    first_slot_start_time = datetime.fromisoformat(
        available_slots[0]["startTime"].replace("Z", "+00:00")
    )
    assert first_slot_start_time > start


def test_get_availability_by_date(test_client):
    """Test finding available applications for a date range."""
    request_data = {
        "startTime": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "endTime": (datetime.now(UTC) + timedelta(days=1, hours=2)).isoformat(),
    }
    response = test_client.post("/availability/by-date", json=request_data)

    assert response.status_code == 200
    data = response.json()
    # All apps should be available as there are no reservations
    assert len(data["applications"]) == 4
