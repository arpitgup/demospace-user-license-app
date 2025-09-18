from fastapi import Depends, FastAPI, Request, HTTPException
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
from .routers import admin, applications, availability, config, reservations, userlogin

app = FastAPI(
    title="Agentspace License Reservation API",
    summary="API for reserving and managing SaaS licenses for the Agentspace demo environment. This API is designed for a global user base, using UTC for all date-time operations and a hybrid real-time/scheduled model for license provisioning.",
)

# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add your modified middleware
app.add_middleware(UserValidationMiddleware)
app.add_middleware(UserCurrentTimeValidationMiddleware)
# app.add_middleware(AdminValidationMiddleware) # This might also need path exclusions

common_dependencies = [Depends(get_user_email), Depends(get_user_current_time)]

app.include_router(applications.router, tags=["Applications"], dependencies=common_dependencies)
app.include_router(availability.router, tags=["Availability"], dependencies=common_dependencies)
app.include_router(reservations.router, tags=["Reservations"], dependencies=common_dependencies)
app.include_router(config.router, tags=["App Config"], dependencies=common_dependencies)
app.include_router(admin.router, tags=["Admin"], dependencies=common_dependencies)

# Include userlogin.router WITHOUT common_dependencies and WITH a prefix
app.include_router(userlogin.router, tags=["User Login"])

@app.get("/api/me", tags=["User"], dependencies=common_dependencies)
def get_user_info(user_email: str = Depends(get_user_email)):
    user = admin_service.get_user(user_email)
    user_name_info = user["name"]
    return UserInfo(
        email=user["primaryEmail"],
        given_name=user_name_info["givenName"],
        family_name=user_name_info["familyName"],
        full_name=user_name_info["fullName"],
    )