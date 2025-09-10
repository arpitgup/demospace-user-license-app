from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..common.constants import X_USER_CURRENT_TIME_HEADER
from datetime import datetime, timezone, timedelta

class UserCurrentTimeValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip swagger documentation endpoints
        if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
            return await call_next(request)

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

        time_difference = abs(server_now_utc - dt_object)
        time_tolerance = timedelta(minutes=2)
        if time_difference > time_tolerance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your system date time is incorrect. Please correct it & try again.",
            )

        response = await call_next(request)
        return response