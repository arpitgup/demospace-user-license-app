from datetime import datetime, timedelta
from shared_lib.db.models import (
    Application,
    Bot,
    BotApplication,
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


def test_get_all_bots(test_client, db_session, seed_data):
    """Test retrieving all bots and their supported applications."""
    bot1 = seed_data["bots"][0]
    bot2 = seed_data["bots"][1]
    app1 = seed_data["apps"][0]
    app2 = seed_data["apps"][1]

    # Clear existing associations for a clean test
    db_session.query(BotApplication).delete()
    db_session.commit()

    # Associate apps with bots
    db_session.add(BotApplication(bot_id=bot1.id, application_id=app1.id))
    db_session.add(BotApplication(bot_id=bot2.id, application_id=app1.id))
    db_session.add(BotApplication(bot_id=bot2.id, application_id=app2.id))
    db_session.commit()

    response = test_client.get("/admin/bots")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(seed_data["bots"])

    bot_map = {}
    for item in data:
        item["applications"].sort(key=lambda x: x["id"])
        bot_map[item["id"]] = item

    # Verify bot1
    assert bot1.id in bot_map
    bot1_data = bot_map[bot1.id]
    assert bot1_data["name"] == bot1.name
    assert len(bot1_data["applications"]) == 1
    assert bot1_data["applications"][0]["id"] == app1.id

    # Verify bot2
    assert bot2.id in bot_map
    bot2_data = bot_map[bot2.id]
    assert bot2_data["name"] == bot2.name
    assert len(bot2_data["applications"]) == 2
    assert bot2_data["applications"][0]["id"] == app1.id
    assert bot2_data["applications"][1]["id"] == app2.id


def test_update_bot_applications_success(test_client, db_session, seed_data):
    """Test successfully updating the applications for a bot."""
    bot = seed_data["bots"][0]
    app1 = seed_data["apps"][0]
    app2 = seed_data["apps"][1]

    # Clear any existing associations for this bot from seed_data to avoid conflicts
    db_session.query(BotApplication).filter(BotApplication.bot_id == bot.id).delete()

    # Initially associate bot with app1
    db_session.add(BotApplication(bot_id=bot.id, application_id=app1.id))
    db_session.commit()

    # Update to be associated with app2 only
    update_data = {"applicationIds": [app2.id]}
    response = test_client.patch(f"/admin/bots/{bot.id}/applications", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == bot.id
    assert len(data["applications"]) == 1
    assert data["applications"][0]["id"] == app2.id

    # Verify in DB
    associations = (
        db_session.query(BotApplication).filter(BotApplication.bot_id == bot.id).all()
    )
    assert len(associations) == 1
    assert associations[0].application_id == app2.id


def test_update_bot_applications_bot_not_found(test_client, seed_data):
    """Test updating applications for a non-existent bot."""
    app1_id = seed_data["apps"][0].id
    update_data = {"applicationIds": [app1_id]}
    response = test_client.patch("/admin/bots/9999/applications", json=update_data)

    assert response.status_code == 404
    assert "Bot not found" in response.json()["detail"]


def test_update_bot_applications_invalid_app_id(test_client, seed_data):
    """Test updating bot applications with an invalid application ID."""
    bot_id = seed_data["bots"][0].id
    update_data = {"applicationIds": [9999]}  # Non-existent app ID
    response = test_client.patch(f"/admin/bots/{bot_id}/applications", json=update_data)

    assert response.status_code == 400
    assert "One or more application IDs are invalid" in response.json()["detail"]


def test_upsert_bots_create_and_update(test_client, db_session, seed_data):
    """Test creating a new bot and updating an existing one."""
    existing_bot = seed_data["bots"][0]
    app1 = seed_data["apps"][0]
    app2 = seed_data["apps"][1]
    app3 = seed_data["apps"][2]

    # Clear existing associations for a clean test
    db_session.query(BotApplication).delete()
    db_session.commit()

    upsert_data = {
        "bots": [
            {
                "email": existing_bot.email,
                "name": "Updated Bot Name",
                "application_ids": [app1.id, app2.id],
            },
            {
                "email": "new-bot@example.com",
                "name": "New Bot",
                "application_ids": [app3.id],
            },
        ]
    }

    response = test_client.post("/admin/bots/upsert", json=upsert_data)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    data_map = {item["email"]: item for item in data}

    # Verify updated bot
    assert existing_bot.email in data_map
    updated_bot_data = data_map[existing_bot.email]
    assert updated_bot_data["name"] == "Updated Bot Name"
    assert len(updated_bot_data["applications"]) == 2
    app_ids = {app["id"] for app in updated_bot_data["applications"]}
    assert app_ids == {app1.id, app2.id}

    # Verify new bot
    assert "new-bot@example.com" in data_map
    new_bot_data = data_map["new-bot@example.com"]
    assert new_bot_data["name"] == "New Bot"
    assert len(new_bot_data["applications"]) == 1
    assert new_bot_data["applications"][0]["id"] == app3.id

    # Verify in DB
    db_bot_updated = db_session.query(Bot).filter(Bot.email == existing_bot.email).one()
    assert db_bot_updated.name == "Updated Bot Name"
    assert len(db_bot_updated.supported_applications) == 2

    db_bot_new = db_session.query(Bot).filter(Bot.email == "new-bot@example.com").one()
    assert db_bot_new.name == "New Bot"
    assert len(db_bot_new.supported_applications) == 1


def test_upsert_bots_invalid_application_id(test_client, seed_data):
    """Test upserting bots with a non-existent application ID."""
    existing_bot = seed_data["bots"][0]
    upsert_data = {
        "bots": [
            {
                "email": existing_bot.email,
                "name": "Updated Bot Name",
                "application_ids": [9999],  # Invalid app ID
            }
        ]
    }

    response = test_client.post("/admin/bots/upsert", json=upsert_data)

    assert response.status_code == 404
    assert "Applications with these IDs do not exist" in response.json()["detail"]

