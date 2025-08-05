from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..common.models import (
    Reservation,
    ReservationStatus,
)
from ..common.schemas import ReservationOut
from ..utils.dependencies import get_db
from ..utils.logging import logger


router = APIRouter()


#TODO: Add test
@router.post(
    "/reservations/{reservation_id}/licenses/provision",
    response_model=ReservationOut,
)
def provision_licenses(reservation_id: int, db: Session = Depends(get_db)):
    """Provisions licenses for a reservation."""
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot provision licenses as reservation is in '{reservation.status.value}' state.",
        )
    # TODO: Update user attributes
    reservation.status = ReservationStatus.ACTIVE
    db.commit()
    db.refresh(reservation)
    logger.info(f"Licenses provisioned for reservation {reservation.id}.")
    return reservation


#TODO: Add test
@router.post(
    "/reservations/{reservation_id}/licenses/deprovision",
    response_model=ReservationOut,
)
def deprovision_licenses(reservation_id: int, db: Session = Depends(get_db)):
    """De-provisions licenses for a reservation."""
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot deprovision licenses as reservation is in '{reservation.status.value}' state.",
        )
    # TODO: Update user attributes here
    reservation.status = ReservationStatus.COMPLETED
    db.commit()
    db.refresh(reservation)
    logger.info(f"Licenses deprovisioned for reservation {reservation.id}.")
    return reservation
