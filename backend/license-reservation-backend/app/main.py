from fastapi import Depends, FastAPI, Request, HTTPException, APIRouter
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

api_router = APIRouter(prefix="/api")

# Add the CORSMiddleware to the application
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=ALLOWED_ORIGINS,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

common_dependencies = [Depends(get_user_email), Depends(get_user_current_time)]
admin_dependencies = [Depends(get_user_email), Depends(get_user_current_time), Depends(get_user_token)]

api_router.include_router(applications.router, tags=["Applications"], dependencies=common_dependencies)
api_router.include_router(availability.router, tags=["Availability"], dependencies=common_dependencies)
api_router.include_router(reservations.router, tags=["Reservations"], dependencies=common_dependencies)
api_router.include_router(config.router, tags=["App Config"], dependencies=common_dependencies)
api_router.include_router(usermanagement.router, tags=["UserManagement"], dependencies=common_dependencies)
api_router.include_router(admin.router, tags=["Admin"], dependencies=admin_dependencies)
api_router.include_router(userlogin.router, tags=["User Login"])

# Add the /api/me endpoint to the api_router
@api_router.get("/me", tags=["User"], dependencies=common_dependencies)
def get_user_info(user_email: str = Depends(get_user_email)):    
    user_ldap = get_user_ldap(user_email)
    return UserInfo(
        email=user_email,
        given_name=user_ldap,
        family_name="",
        full_name=""
    )

# Include the master api_router into the FastAPI app
app.include_router(api_router)

# Add middlewares in the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(UserValidationMiddleware)
app.add_middleware(UserCurrentTimeValidationMiddleware)
app.add_middleware(AdminValidationMiddleware)

# Helper function to create demo user email
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
