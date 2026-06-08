from datetime import datetime, timedelta
from shared_lib.db.models import (
    Application,
    Reservation,
    ReservationStatus,
    DemoDetail,
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
        user_email="another-user@example.com",
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
        user_email="another-user@example.com",
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


def test_get_availability_by_date_v2_partial_conflict(
    test_client, seed_data, db_session
):
    """Test availability when one bot is partially busy."""
    start_time = datetime.now(UTC) + timedelta(days=2)
    end_time = start_time + timedelta(hours=2)

    # Create a reservation for BotA for Slack
    slack_app = next(app for app in seed_data["apps"] if app.name == "Slack")
    reservation = Reservation(
        user_email="another-user@example.com",
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
        user_email="another-user@example.com",
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
        user_email="another-user@example.com",
        bot_id=101,
        start_time=start_time,
        end_time=end_time,
    )
    res1.applications.extend(
        db_session.query(Application).filter(Application.id.in_([1, 2, 3])).all()
    )
    db_session.add(res1)

    # Then, reserve all apps for BotB
    res2 = Reservation(
        user_email="another-user@example.com",
        bot_id=102,
        start_time=start_time,
        end_time=end_time,
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


def test_get_availability_by_application_inactive_app_404(test_client, db_session):
    """Test that requesting availability for an inactive application returns 404."""
    # Deactivate Jira
    jira_app = db_session.query(Application).filter(Application.name == "Jira").one()
    jira_app.is_active = False
    db_session.commit()

    request_data = {
        "applicationId": 1,  # Inactive Jira
        "startTime": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "durationHours": 2,
    }
    response = test_client.post("/availability/by-application", json=request_data)

    assert response.status_code == 404
    assert "not found or is not active" in response.json()["detail"]


def test_get_availability_by_application_filters_inactive_apps(test_client, db_session):
    """Test that the response for a bot doesn't include its other inactive supported apps."""
    # Deactivate Slack, which BotA also supports
    slack_app = db_session.query(Application).filter(Application.name == "Slack").one()
    slack_app.is_active = False
    db_session.commit()

    # Request availability for Jira (which is active)
    request_data = {
        "applicationId": 1,  # Jira
        "startTime": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "durationHours": 2,
    }
    response = test_client.post("/availability/by-application", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data["requestedSlotAvailable"] is True
    slot = data["nextAvailableSlots"][0]
    bot_info = slot["availableBots"][0]
    assert bot_info["name"] == "BotA"

    # BotA supports Jira, Slack, Salesforce. Slack is inactive.
    # So, it should return Jira and Salesforce.
    assert len(bot_info["applications"]) == 2
    app_names = {app["name"] for app in bot_info["applications"]}
    assert "Slack" not in app_names
    assert "Jira" in app_names
    assert "Salesforce" in app_names


def test_get_availability_by_date_v2_filters_inactive_apps(test_client, db_session):
    """Test that the response for a bot doesn't include its inactive supported apps."""
    # Deactivate Slack, which BotA supports
    slack_app = db_session.query(Application).filter(Application.name == "Slack").one()
    slack_app.is_active = False
    db_session.commit()

    start_time = datetime.now(UTC) + timedelta(days=5)
    end_time = start_time + timedelta(hours=2)
    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/availability/by-date/v2", json=request_data)

    assert response.status_code == 200
    data = response.json()
    available_bots = data["availableBots"]
    assert len(available_bots) == 2  # Both bots should be available

    bot_a_info = next(bot for bot in available_bots if bot["name"] == "BotA")

    # BotA supports Jira, Slack, Salesforce. Slack is inactive.
    # So, it should return Jira and Salesforce.
    assert len(bot_a_info["applications"]) == 2
    app_names = {app["name"] for app in bot_a_info["applications"]}
    assert "Slack" not in app_names
    assert "Jira" in app_names
    assert "Salesforce" in app_names

    # BotB should be unaffected
    bot_b_info = next(bot for bot in available_bots if bot["name"] == "BotB")
    assert len(bot_b_info["applications"]) == 2


def test_get_availability_by_date_filters_inactive_apps(test_client, db_session):
    """Test that the response for available apps doesn't include inactive ones."""
    # Deactivate Slack
    slack_app = db_session.query(Application).filter(Application.name == "Slack").one()
    slack_app.is_active = False
    db_session.commit()

    request_data = {
        "startTime": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "endTime": (datetime.now(UTC) + timedelta(days=1, hours=2)).isoformat(),
    }
    response = test_client.post("/availability/by-date", json=request_data)

    assert response.status_code == 200
    data = response.json()
    # All apps except Slack should be available
    assert len(data["applications"]) == 3
    app_names = {app["name"] for app in data["applications"]}
    assert "Slack" not in app_names


def test_get_availability_by_date_v2_cool_off_period(test_client, db_session):
    """Test that the v2 availability endpoint respects the cool-off period."""
    # Create a recent reservation for the user
    previous_end_time = datetime.now(UTC) - timedelta(hours=1)
    previous_start_time = previous_end_time - timedelta(hours=2)
    previous_reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=previous_start_time,
        end_time=previous_end_time,
        status=ReservationStatus.COMPLETED,
    )
    db_session.add(previous_reservation)
    db_session.commit()

    # Request availability for a time that falls within the cool-off period
    start_time = datetime.now(UTC) + timedelta(hours=1)
    end_time = start_time + timedelta(hours=2)
    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/availability/by-date/v2", json=request_data)

    assert response.status_code == 409
    assert "hours after your previous reservation ends" in response.json()["detail"]


def test_get_availability_by_application_cool_off_period(test_client, db_session):
    """Test that the by-application availability endpoint respects the cool-off period."""
    # Create a recent reservation for the user
    previous_end_time = datetime.now(UTC) - timedelta(hours=1)
    previous_start_time = previous_end_time - timedelta(hours=2)
    previous_reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=previous_start_time,
        end_time=previous_end_time,
        status=ReservationStatus.COMPLETED,
    )
    db_session.add(previous_reservation)
    db_session.commit()

    # Request availability for a time that falls within the cool-off period
    start_time = datetime.now(UTC) + timedelta(hours=1)
    request_data = {
        "applicationId": 1,  # Jira
        "startTime": start_time.isoformat(),
        "durationHours": 2,
    }
    response = test_client.post("/availability/by-application", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data["requestedSlotAvailable"] is False
    assert len(data["nextAvailableSlots"]) == 0


def test_get_availability_by_date_v2_cool_off_with_demo_id_all_apps_present(
    test_client, seed_data, db_session
):
    """Test that if demoID is provided, and all demo apps are present in the cool-off reservation, user is blocked (409)."""
    # Create a demo detail
    demo = DemoDetail(
        demo_id="demo123",
        demo_title="Demo 123",
        saas_applications="1,2",  # Jira and Slack
        feature_license_app=False,
    )
    db_session.add(demo)
    
    # Create a recent reservation containing both apps (Jira=1, Slack=2)
    previous_end_time = datetime.now(UTC) - timedelta(hours=1)
    previous_start_time = previous_end_time - timedelta(hours=2)
    previous_reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=previous_start_time,
        end_time=previous_end_time,
        status=ReservationStatus.COMPLETED,
        primary_application_id=1,
    )
    previous_reservation.applications.extend(
        db_session.query(Application).filter(Application.id.in_([1, 2])).all()
    )
    db_session.add(previous_reservation)
    db_session.commit()

    # Request availability with demoID
    start_time = datetime.now(UTC) + timedelta(hours=1)
    end_time = start_time + timedelta(hours=2)
    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    # With query parameter demoID=demo123
    response = test_client.post(
        "/availability/by-date/v2?demoID=demo123", json=request_data
    )

    assert response.status_code == 409
    assert "hours after your previous reservation ends" in response.json()["detail"]


def test_get_availability_by_date_v2_cool_off_with_demo_id_some_apps_absent(
    test_client, seed_data, db_session
):
    """Test that if demoID is provided, and some demo apps are absent in the cool-off reservation, user is NOT blocked (200)."""
    # Create a demo detail
    demo = DemoDetail(
        demo_id="demo123",
        demo_title="Demo 123",
        saas_applications="1,2,3",  # Jira, Slack, Salesforce
        feature_license_app=False,
    )
    db_session.add(demo)
    
    # Create a recent reservation containing only 1 and 2 (Salesforce=3 is absent)
    previous_end_time = datetime.now(UTC) - timedelta(hours=1)
    previous_start_time = previous_end_time - timedelta(hours=2)
    previous_reservation = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=previous_start_time,
        end_time=previous_end_time,
        status=ReservationStatus.COMPLETED,
        primary_application_id=1,
    )
    previous_reservation.applications.extend(
        db_session.query(Application).filter(Application.id.in_([1, 2])).all()
    )
    db_session.add(previous_reservation)
    db_session.commit()

    # Request availability with demoID
    start_time = datetime.now(UTC) + timedelta(hours=1)
    end_time = start_time + timedelta(hours=2)
    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post(
        "/availability/by-date/v2?demoID=demo123", json=request_data
    )

    # Should NOT be blocked because Salesforce (ID=3) is absent from the previous reservation
    assert response.status_code == 200
    data = response.json()
    assert "availableBots" in data


def test_get_availability_by_date_v2_invalid_demo_id(test_client):
    """Test that requesting availability with an invalid demoID returns 404."""
    start_time = datetime.now(UTC) + timedelta(hours=1)
    end_time = start_time + timedelta(hours=2)
    request_data = {
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post(
        "/availability/by-date/v2?demoID=invalid", json=request_data
    )

    assert response.status_code == 404
    assert "Demo with ID 'invalid' not found" in response.json()["detail"]
