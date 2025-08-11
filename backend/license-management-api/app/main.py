from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from shared_lib import admin_service
from shared_lib.dependencies import get_db
from shared_lib.db.models import ReservationStatus, Reservation
from sqlalchemy.orm import Session

from .schemas import DeprovisionLicensesRequest, ProvisionLicensesRequest


app = FastAPI(
    title="Agentspace License Management API",
    summary="API for provisioning and de-provisioning of SaaS licenses for the Agentspace demo users.",
)


# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # List of allowed origins
    allow_credentials=True,  # Allow cookies/authorization headers
    allow_methods=["*"],  # Allow all standard methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


@app.post("/licenses/provision")
def provision_licenses(req: ProvisionLicensesRequest, db: Session = Depends(get_db)):
    """Provisions licenses for a reservation."""
    reservation = (
        db.query(Reservation).filter(Reservation.id == req.reservation_id).first()
    )
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reservation {req.reservation_id} not found.",
        )
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot provision licenses as reservation is in '{reservation.status.value}' state.",
        )
    admin_service.update_user_profile_with_saml_attributes(
        user_email=reservation.user_email,
        bot=reservation.bot,
        applications=reservation.applications,
    )
    reservation.status = ReservationStatus.ACTIVE
    db.commit()
    db.refresh(reservation)
    logger.info(f"Licenses provisioned for reservation {reservation.id}.")
    return reservation


@app.post("/licenses/deprovision")
def deprovision_licenses(
    req: DeprovisionLicensesRequest, db: Session = Depends(get_db)
):
    """De-provisions licenses for a reservation."""
    reservation = (
        db.query(Reservation).filter(Reservation.id == req.reservation_id).first()
    )
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot deprovision licenses as reservation is in '{reservation.status.value}' state.",
        )
    admin_service.clear_saml_attributes_for_user(reservation.user_email)
    reservation.status = ReservationStatus.COMPLETED
    db.commit()
    db.refresh(reservation)
    logger.info(f"Licenses deprovisioned for reservation {reservation.id}.")
    return reservation
