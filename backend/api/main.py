from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .common.constants import ALLOWED_ORIGINS
from .middlewares.user_validation import UserValidationMiddleware
from .routers import admin, applications, availability, config, licenses, reservations
from .utils.dependencies import get_user_email


app = FastAPI()


# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # List of allowed origins
    allow_credentials=True,  # Allow cookies/authorization headers
    allow_methods=["*"],  # Allow all standard methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)
app.add_middleware(UserValidationMiddleware)


app.include_router(admin.router, tags=["Admin"], dependencies=[Depends(get_user_email)])
app.include_router(
    applications.router, tags=["Applications"], dependencies=[Depends(get_user_email)]
)
app.include_router(
    availability.router, tags=["Availability"], dependencies=[Depends(get_user_email)]
)
app.include_router(
    config.router,
    tags=["Application Configuration"],
    dependencies=[Depends(get_user_email)],
)
app.include_router(licenses.router, tags=["License Management"])
app.include_router(
    reservations.router, tags=["Reservations"], dependencies=[Depends(get_user_email)]
)
