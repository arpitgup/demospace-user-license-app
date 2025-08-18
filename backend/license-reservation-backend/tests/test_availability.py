from datetime import datetime, timedelta
from shared_lib.db.models import (
    Application,
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


def test_get_availability_by_date_v2_no_conflicts(test_client):
    """Test finding available bots for a date range when there are no reservations."""
    start_time = datetime.now(UTC) + timedelta(days=1)
    end_time = start_time + timedelta(hours=2)
    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/availability/by-date/v2", json=request_data)

    assert response.status_code == 200
    data = response.json()
    available_bots = data["availableBots"]
    assert len(available_bots) == 2  # Both BotA and BotB should be available

    bot_a_info = next(bot for bot in available_bots if bot["name"] == "BotA")
    bot_b_info = next(bot for bot in available_bots if bot["name"] == "BotB")

    assert len(bot_a_info["applications"]) == 3  # BotA supports 3 apps
    assert len(bot_b_info["applications"]) == 2  # BotB supports 2 apps


def test_get_availability_by_date_v2_partial_conflict(test_client, seed_data, db_session):
    """Test availability when one bot is partially busy."""
    start_time = datetime.now(UTC) + timedelta(days=2)
    end_time = start_time + timedelta(hours=2)

    # Create a reservation for BotA for Slack
    slack_app = next(app for app in seed_data["apps"] if app.name == "Slack")
    reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,  # BotA
        start_time=start_time,
        end_time=end_time,
        status=ReservationStatus.ACTIVE,
    )
    reservation.applications.append(slack_app)
    db_session.add(reservation)
    db_session.commit()

    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/availability/by-date/v2", json=request_data)

    assert response.status_code == 200
    data = response.json()
    available_bots = data["availableBots"]
    assert len(available_bots) == 2  # Both bots should still be available

    bot_a_info = next(bot for bot in available_bots if bot["name"] == "BotA")
    bot_b_info = next(bot for bot in available_bots if bot["name"] == "BotB")

    # BotA is busy with Slack, so it should only be available for Jira and Salesforce
    assert len(bot_a_info["applications"]) == 2
    app_names = {app["name"] for app in bot_a_info["applications"]}
    assert app_names == {"Jira", "Salesforce"}

    # BotB has no conflicts
    assert len(bot_b_info["applications"]) == 2


def test_get_availability_by_date_v2_full_conflict(test_client, seed_data, db_session):
    """Test availability when one bot is fully busy."""
    start_time = datetime.now(UTC) + timedelta(days=3)
    end_time = start_time + timedelta(hours=4)

    # Reserve all of BotA's applications
    bot_a_apps = [
        next(app for app in seed_data["apps"] if app.name == "Jira"),
        next(app for app in seed_data["apps"] if app.name == "Slack"),
        next(app for app in seed_data["apps"] if app.name == "Salesforce"),
    ]
    reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,  # BotA
        start_time=start_time,
        end_time=end_time,
        status=ReservationStatus.ACTIVE,
    )
    reservation.applications.extend(bot_a_apps)
    db_session.add(reservation)
    db_session.commit()

    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/availability/by-date/v2", json=request_data)

    assert response.status_code == 200
    data = response.json()
    available_bots = data["availableBots"]
    # Only BotB should be available
    assert len(available_bots) == 1
    assert available_bots[0]["name"] == "BotB"
    assert len(available_bots[0]["applications"]) == 2


def test_get_availability_by_date_v2_no_bots_available(test_client, db_session):
    """Test availability when no bots are available at all."""
    start_time = datetime.now(UTC) + timedelta(days=4)
    end_time = start_time + timedelta(hours=1)

    # First, reserve all apps for BotA
    res1 = Reservation(
        user_email=TEST_USER, bot_id=101, start_time=start_time, end_time=end_time
    )
    res1.applications.extend(
        db_session.query(Application)
        .filter(Application.id.in_([1, 2, 3]))
        .all()
    )
    db_session.add(res1)

    # Then, reserve all apps for BotB
    res2 = Reservation(
        user_email=TEST_USER, bot_id=102, start_time=start_time, end_time=end_time
    )
    res2.applications.extend(
        db_session.query(Application).filter(Application.id.in_([3, 4])).all()
    )
    db_session.add(res2)
    db_session.commit()

    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/availability/by-date/v2", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert len(data["availableBots"]) == 0
