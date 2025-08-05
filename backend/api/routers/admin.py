from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from typing import List
from sqlalchemy.orm import Session

from ..common.models import (
    Reservation,
    ReservationStatus,
)
from ..common.schemas import (
    BulkCancelReservationsRequest,
    BulkCancelReservationsResponse,
    ReservationOut,
)
from ..utils.background_tasks import delete_reservation_tasks
from ..utils.dependencies import get_user_email, get_db
from ..utils.logging import logger


router = APIRouter()


@router.get(
    "/admin/reservations", response_model=List[ReservationOut], tags=["Reservations"]
)
def get_user_reservations(
    db: Session = Depends(get_db), user_email: str = Depends(get_user_email)
):
    """
    Retrieves all reservations made by a specific user.
    """
    # TODO: check for admin user
    logger.info(f"Admin User {user_email}: Fetching all reservations")
    reservations = db.query(Reservation).all()
    return reservations


@router.post(
    "/admin/reservations/bulk-cancel",
    response_model=BulkCancelReservationsResponse,
)
def bulk_cancel_reservations(
    req: BulkCancelReservationsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_user_email),
):
    """
    Cancels a list of reservations by their IDs.
    """
    # TODO: check for admin user
    logger.info(
        f"Admin User {user_email}: Bulk cancelling reservations: {req.reservation_ids}"
    )
    successfully_cancelled = []
    failed_to_cancel = []

    reservations = (
        db.query(Reservation).filter(Reservation.id.in_(req.reservation_ids)).all()
    )
    reservation_map = {res.id: res for res in reservations}

    for res_id in req.reservation_ids:
        reservation = reservation_map.get(res_id)
        if not reservation or reservation.status in [
            ReservationStatus.CANCELLED,
            ReservationStatus.COMPLETED,
        ]:
            failed_to_cancel.append(res_id)
            continue
        reservation.status = ReservationStatus.CANCELLED
        successfully_cancelled.append(res_id)

    try:
        db.commit()
        for reservation_id in successfully_cancelled:
            background_tasks.add_task(delete_reservation_tasks, reservation_id)
    except Exception as e:
        db.rollback()
        logger.error(f"An unexpected error occurred during bulk cancel: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during bulk cancellation.",
        )

    return BulkCancelReservationsResponse(
        successfully_cancelled=successfully_cancelled, failed_to_cancel=failed_to_cancel
    )
