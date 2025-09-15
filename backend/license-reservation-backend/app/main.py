from fastapi import Depends, FastAPI
from fastapi import Request, HTTPException
from starlette.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from shared_lib.dependencies import get_user_email, get_user_current_time
from shared_lib import admin_service
from datetime import datetime, timezone, timedelta
from .common.constants import ALLOWED_ORIGINS
from .common.constants import X_USER_CURRENT_TIME_HEADER
from .common.schemas import UserInfo
from .middlewares.user_validation import UserValidationMiddleware
from .middlewares.admin_validation import AdminValidationMiddleware
from .middlewares.user_current_time_validation import UserCurrentTimeValidationMiddleware
from .routers import admin, applications, availability, config, reservations


app = FastAPI(
    title="Agentspace License Reservation API",
    summary="API for reserving and managing SaaS licenses for the Agentspace demo environment. This API is designed for a global user base, using UTC for all date-time operations and a hybrid real-time/scheduled model for license provisioning.",
    dependencies=[Depends(get_user_email), Depends(get_user_current_time)],    
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
app.add_middleware(UserCurrentTimeValidationMiddleware)

# TODO: uncomment below line to enable admin validation middleware,
# ensure that the PORTAL_ADMIN_GROUP_EMAIL environment variable is updated
# app.add_middleware(AdminValidationMiddleware)

app.include_router(applications.router, tags=["Applications"])
app.include_router(availability.router, tags=["Availability"])
app.include_router(reservations.router, tags=["Reservations"])
app.include_router(config.router, tags=["App Config"])
app.include_router(admin.router, tags=["Admin"])


@app.get("/api/me", tags=["User"])
def get_user_info(user_email: str = Depends(get_user_email)):
    user = admin_service.get_user(user_email)
    user_name_info = user["name"]
    return UserInfo(
        email=user["primaryEmail"],
        given_name=user_name_info["givenName"],
        family_name=user_name_info["familyName"],
        full_name=user_name_info["fullName"],
    )
