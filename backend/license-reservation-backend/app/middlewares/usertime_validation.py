from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse

from ..common.constants import X_DEMO_USER_EMAIL_HEADER, X_USER_CURRENT_TIME_HEADER
from datetime import datetime, timezone, timedelta

DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"

class UserCurrentTimeValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        user_datetime_str = request.headers.get(X_USER_CURRENT_TIME_HEADER)
        if not user_datetime_str:
            return JSONResponse(
                status_code=400,
                content={"detail": f"Missing required header: {X_USER_CURRENT_TIME_HEADER}."}
            )

        server_now_utc = datetime.now(timezone.utc)

        try:
            # Parse the user's datetime string into a datetime object
            # and convert it to UTC. We assume the incoming timestamp
            # is in a specific, known format.
            user_datetime = datetime.strptime(user_datetime_str, DATETIME_FORMAT)
            user_datetime_utc = user_datetime.replace(tzinfo=timezone.utc)

        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid datetime format. Please use YYYY-MM-DD HH:MM:SS."}
            )

        # Calculate the time difference between the user and server timestamps
        time_difference = abs(server_now_utc - user_datetime_utc)
        time_tolerance = timedelta(minutes=2)        
        if time_difference > time_tolerance:
            return JSONResponse(
                status_code=400,
                content={"detail": "Request timestamp is not within the acceptable time window (+/- 2 minutes) of the server time."}
            )                
        response = await call_next(request)
        return response
