from fastapi import Depends, FastAPI, Request, HTTPException
from starlette.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from shared_lib.dependencies import get_user_email, get_user_current_time, get_user_token
from shared_lib import admin_service
from datetime import datetime, timezone, timedelta
from .common.constants import ALLOWED_ORIGINS
from .common.constants import X_USER_CURRENT_TIME_HEADER
from .common.schemas import UserInfo
from .middlewares.user_validation import UserValidationMiddleware
from .middlewares.admin_validation import AdminValidationMiddleware
from .middlewares.user_current_time_validation import UserCurrentTimeValidationMiddleware
from .routers import admin, applications, availability, config, reservations, userlogin, usermanagement


app = FastAPI(
    title="Gemini Enterprise User Management & License Reservation API",
    summary="API for User Management & reserving and managing SaaS licenses for the Agentspace demo environment. This API is designed for a global user base, using UTC for all date-time operations and a hybrid real-time/scheduled model for license provisioning.",
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

# TODO: uncomment below line to enable admin validation middleware,
# ensure that the PORTAL_ADMIN_GROUP_EMAIL  environment variable is updated
# app.add_middleware(AdminValidationMiddleware)

common_dependencies = [Depends(get_user_email), Depends(get_user_current_time)]
# admin_dependencies = [Depends(get_user_email), Depends(get_user_current_time), Depends(get_user_token)]
admin_dependencies = [Depends(get_user_email), Depends(get_user_current_time)]

app.include_router(applications.router, tags=["Applications"], dependencies=common_dependencies)
app.include_router(availability.router, tags=["Availability"], dependencies=common_dependencies)
app.include_router(reservations.router, tags=["Reservations"], dependencies=common_dependencies)
app.include_router(config.router, tags=["App Config"], dependencies=common_dependencies)
app.include_router(usermanagement.router, tags=["UserManagement"], dependencies=common_dependencies)
app.include_router(admin.router, tags=["Admin"], dependencies=admin_dependencies)

# Include userlogin.router WITHOUT common_dependencies and WITH a prefix
app.include_router(userlogin.router, tags=["User Login"])

def get_user_ldap(user_email: str) -> str:
    try:
        local_part = user_email.split('@')[0]
        dash_index = local_part.find('-')

        if dash_index != -1:
            return local_part[:dash_index]
        else:
            return ""

    except IndexError:
        return ""

@app.get("/api/me", tags=["User"], dependencies=common_dependencies)
def get_user_info(user_email: str = Depends(get_user_email)):    
    user_ldap = get_user_ldap(user_email)
    return UserInfo(
        email=user_email,
        given_name=user_ldap,
        family_name="",
        full_name=""
    )