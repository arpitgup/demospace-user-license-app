from datetime import datetime, timedelta
from shared_lib.db.models import (
    Reservation,
    ReservationStatus,
)
from shared_lib.dependencies import get_db, get_user_email
from app.utils.background_tasks import (
    schedule_reservation_tasks,
    delete_reservation_tasks,
)

from .conftest import TEST_USER, UTC


def test_make_reservation_success(test_client, mock_background_tasks_add_task):
    """Test successfully creating a reservation."""
    start_time = datetime.now(UTC) + timedelta(days=2)
    end_time = start_time + timedelta(hours=2)

    request_data = {
        "primaryApplicationId": 1,  # Jira
        "secondaryApplicationIds": [2],  # Slack
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/reservations", json=request_data)

    data = response.json()
    assert response.status_code == 201
    assert data["userEmail"] == TEST_USER
    assert data["bot"]["name"] == "BotA"  # Only BotA supports both Jira and Slack
    assert len(data["applications"]) == 2
    assert data["status"] == "PENDING"
    mock_background_tasks_add_task.assert_called_once_with(
        schedule_reservation_tasks,
        data["id"],
        start_time,
        end_time,
    )


def test_make_reservation_with_partial_availability(test_client, seed_data, db_session):
    """Test trying to create a reservation for a bot that supports requested app, but has an existing reservation for a different app."""
    start_time = datetime.now(UTC) + timedelta(days=3)
    end_time = start_time + timedelta(hours=2)
    # Pre-create a reservation for BotA with Jira
    reservation = Reservation(
        user_email="other_user@example.com",
        bot_id=101,
        start_time=start_time,
        end_time=end_time,
    )
    reservation.applications.append(seed_data["apps"][0])  # Jira
    db_session.add(reservation)
    db_session.commit()

    # Attempt to book Slack (which only BotA supports) in the same slot
    request_data = {
        "primaryApplicationId": 2,  # Slack
        "secondaryApplicationIds": [],
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    # This should pass because BotA is available for Slack,
    # even though it has an existing reservation for Jira
    response = test_client.post("/reservations", json=request_data)

    data = response.json()
    assert response.status_code == 201
    assert data["bot"]["name"] == "BotA"


def test_make_reservation_conflict(test_client, seed_data, db_session):
    """Test trying to create a reservation that conflicts with an existing one."""
    start_time = datetime.now(UTC) + timedelta(days=3)
    end_time = start_time + timedelta(hours=2)
    # Pre-create a reservation for BotA with Jira
    reservation = Reservation(
        user_email="other_user@example.com",
        bot_id=101,
        start_time=start_time,
        end_time=end_time,
    )
    reservation.applications.append(seed_data["apps"][0])  # Jira
    db_session.add(reservation)
    db_session.commit()

    # Attempt to book BotA with Jira in the same slot, which should fail
    request_data_conflict = {
        "primaryApplicationId": 1,  # Jira
        "secondaryApplicationIds": [],
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/reservations", json=request_data_conflict)

    assert response.status_code == 409
    assert "none are available" in response.json()["detail"]


def test_make_reservation_no_suitable_bot(test_client):
    """Test making a reservation where no single bot supports all apps."""
    start_time = datetime.now(UTC) + timedelta(days=4)
    end_time = start_time + timedelta(hours=2)

    request_data = {
        "primaryApplicationId": 1,  # Jira (Only BotA)
        "secondaryApplicationIds": [4],  # Box (Only BotB)
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
    }
    response = test_client.post("/reservations", json=request_data)

    assert response.status_code == 404
    assert "No single bot found" in response.json()["detail"]


def test_get_user_reservations(test_client, seed_data, db_session):
    """Test retrieving all reservations for a specific user."""
    # Create two reservations for TEST_USER
    res1 = Reservation(
        user_email=TEST_USER,
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    res1.applications.append(seed_data["apps"][0])
    res2 = Reservation(
        user_email=TEST_USER,
        bot_id=102,
        start_time=datetime.now(UTC) + timedelta(days=1),
        end_time=datetime.now(UTC) + timedelta(days=1, hours=1),
    )
    res2.applications.append(seed_data["apps"][2])
    # Create one for another user
    res3 = Reservation(
        user_email="another-user@example.com",
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    res3.applications.append(seed_data["apps"][1])
    db_session.add_all([res1, res2, res3])
    db_session.commit()

    response = test_client.get("/reservations")

    data = response.json()
    assert response.status_code == 200
    assert len(data) == 2
    assert data[0]["userEmail"] == TEST_USER
    assert data[1]["userEmail"] == TEST_USER


def test_get_user_reservations_none_found(test_client):
    """Test retrieving reservations for a user who has none."""
    response = test_client.get("/reservations")

    assert response.status_code == 200
    assert response.json() == []


def test_cancel_reservation_success(
    test_client, db_session, mock_background_tasks_add_task
):
    """Test successfully cancelling a reservation."""
    res = Reservation(
        id=99,
        user_email=TEST_USER,
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
        status=ReservationStatus.PENDING,
    )
    db_session.add(res)
    db_session.commit()

    response = test_client.post("/reservations/99/cancel")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CANCELLED"
    mock_background_tasks_add_task.assert_called_once_with(
        delete_reservation_tasks, res.id
    )


def test_cancel_reservation_not_found(test_client):
    """Test cancelling a reservation that does not exist."""
    response = test_client.post("/reservations/9999/cancel")

    assert response.status_code == 404


def test_cancel_reservation_already_cancelled(test_client, db_session):
    """Test trying to cancel a reservation that is already cancelled."""
    res = Reservation(
        id=100,
        user_email=TEST_USER,
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
        status=ReservationStatus.CANCELLED,
    )
    db_session.add(res)
    db_session.commit()

    response = test_client.post("/reservations/100/cancel")

    assert response.status_code == 409
    assert "already in 'CANCELLED' state" in response.json()["detail"]


def test_cancel_reservations_made_by_another_user(test_client, db_session):
    """Test trying to cancel a reservation that was made by another user."""
    res = Reservation(
        id=100,
        user_email="test-user-2@example.com",
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
        status=ReservationStatus.CANCELLED,
    )
    db_session.add(res)
    db_session.commit()

    response = test_client.post("/reservations/100/cancel")

    assert response.status_code == 401
    assert "You cannot cancel a reservation made by others" in response.json()["detail"]
