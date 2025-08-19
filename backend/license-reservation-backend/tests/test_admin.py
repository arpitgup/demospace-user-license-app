from datetime import datetime, timedelta
from shared_lib.db.models import (
    Application,
    Reservation,
    ReservationStatus,
)
from shared_lib.dependencies import get_db, get_user_email
from unittest.mock import call
from app.utils.background_tasks import (
    delete_license_deprovisioning_task,
    schedule_deprovisioning_task,
)

from .conftest import TEST_USER, UTC


def test_get_user_reservations(test_client, seed_data, db_session):
    """Test retrieving all reservations for a specific user."""
    # Create 3 reservations with different users
    res1 = Reservation(
        user_email="test-user-1@example.com",
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    res1.applications.append(seed_data["apps"][0])
    res2 = Reservation(
        user_email="test-user-2@example.com",
        bot_id=102,
        start_time=datetime.now(UTC) + timedelta(days=1),
        end_time=datetime.now(UTC) + timedelta(days=1, hours=1),
    )
    res2.applications.append(seed_data["apps"][2])
    res3 = Reservation(
        user_email="test-user-3@example.com",
        bot_id=101,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    res3.applications.append(seed_data["apps"][1])
    db_session.add_all([res1, res2, res3])
    db_session.commit()

    response = test_client.get("/admin/reservations")

    data = response.json()
    assert response.status_code == 200
    assert len(data) == 3


def test_bulk_cancel_reservations(
    test_client, db_session, mock_background_tasks_add_task
):
    """Test the bulk cancellation endpoint."""
    res1 = Reservation(
        id=201,
        user_email="test-user-1@example.com",
        bot_id=101,
        status=ReservationStatus.PENDING,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    res2 = Reservation(
        id=202,
        user_email="test-user-2@example.com",
        bot_id=101,
        status=ReservationStatus.ACTIVE,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    res3 = Reservation(
        id=203,
        user_email="test-user-3@example.com",
        bot_id=101,
        status=ReservationStatus.CANCELLED,
        start_time=datetime.now(UTC),
        end_time=datetime.now(UTC) + timedelta(hours=1),
    )
    db_session.add_all([res1, res2, res3])
    db_session.commit()

    request_data = {
        "reservationIds": [
            201,
            202,
            203,
            999,
        ]  # 2 valid, 1 already cancelled, 1 non-existent
    }
    response = test_client.post("/admin/reservations/bulk-cancel", json=request_data)

    data = response.json()
    assert response.status_code == 200
    assert sorted(data["successfullyCancelled"]) == [201, 202]
    assert sorted(data["failedToCancel"]) == [203, 999]
    assert mock_background_tasks_add_task.call_count == 2
    # Verify in DB
    cancelled_res = db_session.query(Reservation).filter(Reservation.id == 201).one()
    assert cancelled_res.status == ReservationStatus.CANCELLED


def test_extend_reservation_success(
    test_client, db_session, mock_background_tasks_add_task
):
    """Test successfully extending an active reservation."""
    start_time = datetime.now(UTC)
    end_time = start_time + timedelta(hours=2)
    reservation = Reservation(
        id=301,
        user_email=TEST_USER,
        bot_id=101,
        status=ReservationStatus.ACTIVE,
        start_time=start_time,
        end_time=end_time,
    )
    db_session.add(reservation)
    db_session.commit()

    new_end_time = end_time + timedelta(hours=1)
    response = test_client.patch(
        f"/admin/reservations/{reservation.id}/extend",
        json={"endTime": new_end_time.isoformat()},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["endTime"] == new_end_time.isoformat().replace("+00:00", "Z")
    updated_reservation = (
        db_session.query(Reservation).filter(Reservation.id == reservation.id).one()
    )
    updated_end_time = updated_reservation.end_time
    if updated_end_time.tzinfo is None:
        updated_end_time = updated_end_time.replace(tzinfo=UTC)
    assert updated_end_time.isoformat() == new_end_time.isoformat()
    delete_task_call = call(
        delete_license_deprovisioning_task,
        reservation.id,
        reservation.deprovisioning_task_id,
    )
    reschedule_task_call = call(
        schedule_deprovisioning_task, reservation.id, reservation.end_time
    )
    assert mock_background_tasks_add_task.call_args_list == [
        delete_task_call,
        reschedule_task_call,
    ]


def test_extend_reservation_not_active(test_client, db_session):
    """Test extending a reservation that is not active."""
    start_time = datetime.now(UTC)
    end_time = start_time + timedelta(hours=2)
    reservation = Reservation(
        id=401,
        user_email=TEST_USER,
        bot_id=101,
        status=ReservationStatus.PENDING,
        start_time=start_time,
        end_time=end_time,
    )
    db_session.add(reservation)
    db_session.commit()

    new_end_time = end_time + timedelta(hours=1)
    response = test_client.patch(
        f"/admin/reservations/{reservation.id}/extend",
        json={"endTime": new_end_time.isoformat()},
    )

    assert response.status_code == 400
    assert "Only active reservations can be extended" in response.json()["detail"]


def test_extend_reservation_invalid_end_time(test_client, db_session):
    """Test extending a reservation with an invalid new end time."""
    start_time = datetime.now(UTC)
    end_time = start_time + timedelta(hours=2)
    reservation = Reservation(
        id=501,
        user_email=TEST_USER,
        bot_id=101,
        status=ReservationStatus.ACTIVE,
        start_time=start_time,
        end_time=end_time,
    )
    db_session.add(reservation)
    db_session.commit()

    new_end_time = end_time - timedelta(hours=1)  # Invalid end time
    response = test_client.patch(
        f"/admin/reservations/{reservation.id}/extend",
        json={"endTime": new_end_time.isoformat()},
    )

    assert response.status_code == 400
    assert (
        "New end time must be after the current end time" in response.json()["detail"]
    )


def test_extend_reservation_conflict(test_client, db_session):
    """Test extending a reservation when the bot has a conflict."""
    start_time1 = datetime.now(UTC)
    end_time1 = start_time1 + timedelta(hours=2)
    reservation1 = Reservation(
        id=601,
        user_email=TEST_USER,
        bot_id=101,
        status=ReservationStatus.ACTIVE,
        start_time=start_time1,
        end_time=end_time1,
    )

    start_time2 = end_time1 + timedelta(minutes=30)
    end_time2 = start_time2 + timedelta(hours=1)
    reservation2 = Reservation(
        id=602,
        user_email="another-user@example.com",
        bot_id=101,  # Same bot
        status=ReservationStatus.PENDING,
        start_time=start_time2,
        end_time=end_time2,
    )
    db_session.add_all([reservation1, reservation2])
    db_session.commit()

    new_end_time = start_time2 + timedelta(
        minutes=15
    )  # This will conflict with reservation2
    response = test_client.patch(
        f"/admin/reservations/{reservation1.id}/extend",
        json={"endTime": new_end_time.isoformat()},
    )

    assert response.status_code == 400
    assert "Bot is not available for the extended period" in response.json()["detail"]


def test_extend_reservation_not_found(test_client):
    """Test extending a reservation that does not exist."""
    response = test_client.patch(
        "/admin/reservations/9999/extend",
        json={"endTime": datetime.now(UTC).isoformat()},
    )
    assert response.status_code == 404


def test_update_application_status_activate(test_client, db_session, seed_data):
    """Test activating an application."""
    app_id = seed_data["apps"][0].id
    app_to_update = db_session.query(Application).filter(Application.id == app_id).one()
    app_to_update.is_active = False
    db_session.commit()

    response = test_client.patch(
        f"/admin/applications/{app_id}",
        json={"isActive": True},
    )

    assert response.status_code == 204
    updated_app = db_session.query(Application).filter(Application.id == app_id).one()
    assert updated_app.is_active is True


def test_update_application_status_deactivate(test_client, db_session, seed_data):
    """Test deactivating an application."""
    app_id = seed_data["apps"][1].id

    response = test_client.patch(
        f"/admin/applications/{app_id}",
        json={"isActive": False},
    )

    assert response.status_code == 204
    updated_app = db_session.query(Application).filter(Application.id == app_id).one()
    assert updated_app.is_active is False


def test_update_application_status_not_found(test_client):
    """Test updating a non-existent application."""
    response = test_client.patch(
        "/admin/applications/9999",
        json={"isActive": True},
    )
    assert response.status_code == 404


def test_get_applications(test_client, seed_data):
    """Test retrieving all applications."""
    response = test_client.get("/admin/applications")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(seed_data["apps"])
    # Check a sample
    app_from_api = data[0]
    app_from_db = seed_data["apps"][0]
    assert app_from_api["id"] == app_from_db.id
    assert app_from_api["name"] == app_from_db.name
    assert app_from_api["isActive"] == app_from_db.is_active
    assert app_from_api["licenseType"] == app_from_db.license_type.value


def test_update_applications_success(test_client, db_session, seed_data):
    """Test successfully updating multiple applications."""
    app1 = seed_data["apps"][0]
    app2 = seed_data["apps"][1]

    update_data = {
        "applications": [
            {
                "id": app1.id,
                "name": "Updated App 1 Name",
                "isActive": not app1.is_active,
                "licenseType": "SUBSCRIPTION",
                "licenseGroup": None,
            },
            {
                "id": app2.id,
                "name": app2.name,  # No name change
                "isActive": not app2.is_active,
                "licenseType": "ENVIRONMENT",
                "licenseGroup": "env-group@example.com",
            },
        ]
    }

    response = test_client.patch("/admin/applications", json=update_data)

    assert response.status_code == 204


def test_update_applications_not_found(test_client, seed_data):
    """Test updating applications when one does not exist."""
    app1 = seed_data["apps"][0]
    update_data = {
        "applications": [
            {
                "id": app1.id,
                "name": "Updated App 1 Name",
                "isActive": not app1.is_active,
                "licenseType": "SUBSCRIPTION",
                "licenseGroup": None
            },
            {
                "id": 9999,
                "name": "Non-existent app",
                "isActive": True,
                "licenseType": "SUBSCRIPTION",
                "licenseGroup": None
            },
        ]
    }

    response = test_client.patch("/admin/applications", json=update_data)

    assert response.status_code == 404
    assert "One or more applications not found" in response.json()["detail"]


def test_update_applications_environment_without_group_email(
    test_client, seed_data
):
    """Test updating an application to ENVIRONMENT license type without a group email."""
    app1 = seed_data["apps"][0]
    update_data = {
        "applications": [
            {
                "id": app1.id,
                "name": "Updated App 1 Name",
                "isActive": True,
                "licenseType": "ENVIRONMENT",
                "licenseGroup": None,
            }
        ]
    }

    response = test_client.patch("/admin/applications", json=update_data)

    assert response.status_code == 400
    assert (
        "Group email is required for application with license type as ENVIRONMENT."
        in response.json()["detail"]
    )
