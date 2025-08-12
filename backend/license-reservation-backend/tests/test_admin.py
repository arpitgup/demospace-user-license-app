from datetime import datetime, timedelta
from shared_lib.db.models import (
    Reservation,
    ReservationStatus,
)
from shared_lib.dependencies import get_db, get_user_email

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


def test_bulk_cancel_reservations(test_client, db_session, mock_background_tasks_add_task):
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

