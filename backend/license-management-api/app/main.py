from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from shared_lib import admin_service
from shared_lib.dependencies import get_db
from shared_lib.db.models import ReservationStatus, Reservation, DowntimeStatus, ApplicationDowntime
from sqlalchemy.orm import Session

from .schemas import DeprovisionLicensesRequest, ProvisionLicensesRequest, DowntimeEventRequest
from .utils import provision_app_licenses, deprovision_app_licenses, activate_applications, deactivate_applications


app = FastAPI(
    title="Agentspace License Management API",
    summary="API for provisioning and de-provisioning of SaaS licenses for the Agentspace demo users.",
)


# Add the CORSMiddleware to the applications
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
    provision_app_licenses(reservation)
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

    original_status = reservation.status
    if original_status not in [ReservationStatus.ACTIVE, ReservationStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot deprovision licenses as reservation is in '{original_status.value}' state.",
        )
    deprovision_app_licenses(reservation, db=db)
    if original_status == ReservationStatus.ACTIVE:
        reservation.status = ReservationStatus.COMPLETED        
    elif original_status == ReservationStatus.CANCELLED:        
        reservation.status = ReservationStatus.CANCELLED        

    db.commit()
    db.refresh(reservation)
    logger.info(f"Licenses deprovisioned for reservation {reservation.id}.")
    return reservation

@app.post("/admin/downtime/start")
def start_downtime(req: DowntimeEventRequest, db: Session = Depends(get_db)):
    """Updates the status of an application downtime to ACTIVE and deactivates the application."""
    downtime_entry = (
        db.query(ApplicationDowntime).filter(ApplicationDowntime.id == req.downtime_id).first()
    )
    if not downtime_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Downtime entry {req.downtime_id} not found.",
        )
    if downtime_entry.status != DowntimeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start downtime as the entry is in '{downtime_entry.status.value}' state.",
        )
    
    # Deactivate the application
    deactivate_applications(req.downtime_id, db)
    
    # Update downtime status
    downtime_entry.status = DowntimeStatus.ACTIVE
    db.commit()
    db.refresh(downtime_entry)
    logger.info(f"Downtime for application {downtime_entry.application_id} has started.")
    return {"message": "Downtime started successfully."}


@app.post("/admin/downtime/end")
def end_downtime(req: DowntimeEventRequest, db: Session = Depends(get_db)):
    """Updates the status of an application downtime to COMPLETED and activates the application."""
    downtime_entry = (
        db.query(ApplicationDowntime).filter(ApplicationDowntime.id == req.downtime_id).first()
    )
    if not downtime_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Downtime entry {req.downtime_id} not found.",
        )
    if downtime_entry.status != DowntimeStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot end downtime as the entry is in '{downtime_entry.status.value}' state.",
        )
    
    # Activate the application
    activate_applications(req.downtime_id, db)
    
    # Update downtime status
    downtime_entry.status = DowntimeStatus.COMPLETED
    db.commit()
    db.refresh(downtime_entry)
    logger.info(f"Downtime for application {downtime_entry.application_id} has ended.")
    return {"message": "Downtime ended successfully."}