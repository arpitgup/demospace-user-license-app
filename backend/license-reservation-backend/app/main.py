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
origins = [
    "http://localhost:4200",
    "https://license-reservation-app-prod-385039775654.us-central1.run.app",
    "https://license-reservation-app-dev-385039775654.us-central1.run.app"
]
    
# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # List of allowed origins
    # allow_origins=origins
    allow_credentials=False,  # Allow cookies/authorization headers
    allow_methods=["*"],  # Allow all standard methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)
app.add_middleware(UserValidationMiddleware)
@app.middleware("http")
async def user_current_time(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    
    # Skip swagger documentation endpoints
    if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
        return await call_next(request)

    try:
        if (
            X_USER_CURRENT_TIME_HEADER not in request.headers
            or not request.headers[X_USER_CURRENT_TIME_HEADER]
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Missing required header: {X_USER_CURRENT_TIME_HEADER}.",
            )

        user_datetime_str = request.headers.get(X_USER_CURRENT_TIME_HEADER)
        server_now_utc = datetime.now(timezone.utc)

        try:
            dt_object = datetime.fromisoformat(user_datetime_str)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid datetime format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SS.ffffff).",
            )

        # Calculate the time difference between the user and server timestamps
        time_difference = abs(server_now_utc - dt_object)
        time_tolerance = timedelta(minutes=2)
        if time_difference > time_tolerance:
            raise HTTPException(
                status_code=400,
                detail="Your system date time is incorrect. Please correct it & try again.",
            )
    except HTTPException as http_exc:
        response= JSONResponse(
            status_code=400, content={"detail": http_exc.detail}
        )
        response.headers["Access-Control-Allow-Origin"]="*"
        return response

    response = await call_next(request)
    return response

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