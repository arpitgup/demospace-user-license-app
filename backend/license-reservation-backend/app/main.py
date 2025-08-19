from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared_lib.dependencies import get_user_email

from .common.constants import ALLOWED_ORIGINS
from .middlewares.user_validation import UserValidationMiddleware
from .routers import admin, applications, availability, config, reservations


app = FastAPI(
    title="Agentspace License Reservation API",
    summary="API for reserving and managing SaaS licenses for the Agentspace demo environment. This API is designed for a global user base, using UTC for all date-time operations and a hybrid real-time/scheduled model for license provisioning.",
    dependencies=[Depends(get_user_email)],
)


# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # List of allowed origins
    allow_credentials=True,  # Allow cookies/authorization headers
    allow_methods=["*"],  # Allow all standard methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)
app.add_middleware(UserValidationMiddleware)
# TODO: add admin middleware


app.include_router(applications.router, tags=["Applications"])
app.include_router(availability.router, tags=["Availability"])
app.include_router(reservations.router, tags=["Reservations"])
app.include_router(config.router, tags=["App Config"])
app.include_router(admin.router, tags=["Admin"])
