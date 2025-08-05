from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .common.constants import ALLOWED_ORIGINS
from .routers import admin, applications, availability, config, licenses, reservations


app = FastAPI()


# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # List of allowed origins
    allow_credentials=True,  # Allow cookies/authorization headers
    allow_methods=["*"],  # Allow all standard methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


app.include_router(admin.router, tags=["Admin"])
app.include_router(applications.router, tags=["Applications"])
app.include_router(availability.router, tags=["Availability"])
app.include_router(config.router, tags=["Application Configuration"])
app.include_router(licenses.router, tags=["License Management"])
app.include_router(reservations.router, tags=["Reservations"])
