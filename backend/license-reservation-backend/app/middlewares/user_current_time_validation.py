from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..common.constants import X_USER_CURRENT_TIME_HEADER
from datetime import datetime, timezone, timedelta

# class UserCurrentTimeValidationMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         if request.method == "OPTIONS":
#             return await call_next(request)
        
#         # Skip swagger documentation endpoints
#         if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
#             return await call_next(request)

#         try:
#             if (
#                 X_USER_CURRENT_TIME_HEADER not in request.headers
#                 or not request.headers[X_USER_CURRENT_TIME_HEADER]
#             ):
#                 raise HTTPException(
#                     status_code=400,
#                     detail=f"Missing required header: {X_USER_CURRENT_TIME_HEADER}.",
#                 )

#             user_datetime_str = request.headers.get(X_USER_CURRENT_TIME_HEADER)
#             server_now_utc = datetime.now(timezone.utc)

#             try:
#                 dt_object = datetime.fromisoformat(user_datetime_str)
#             except ValueError:
#                 raise HTTPException(
#                     status_code=400,
#                     detail="Invalid datetime format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SS.ffffff).",
#                 )

#             # Calculate the time difference between the user and server timestamps
#             time_difference = abs(server_now_utc - dt_object)
#             time_tolerance = timedelta(minutes=2)
#             if time_difference > time_tolerance:
#                 raise HTTPException(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     detail="Your system date time is incorrect. Please correct it & try again.",
#                 )
#         except HTTPException as http_exc:
#             response= JSONResponse(
#                 status_code=http_exc.status_code, content={"detail": http_exc.detail}
#             )
#             response.headers["Access-Control-Allow-Origin"]="*"
#             return response

#         response = await call_next(request)
#         return response

EXCLUDE_PATHS = (
    "/docs",
    "/openapi.json",
    "/auth"    
)

class UserCurrentTimeValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        
        if request.url.path.startswith(EXCLUDE_PATHS):
            return await call_next(request)

        try:
            if (
                X_USER_CURRENT_TIME_HEADER not in request.headers
                or not request.headers[X_USER_CURRENT_TIME_HEADER]
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required header: {X_USER_CURRENT_TIME_HEADER}.",
                )

            user_datetime_str = request.headers.get(X_USER_CURRENT_TIME_HEADER)
            server_now_utc = datetime.now(timezone.utc)

            try:
                # dt_object = datetime.fromisoformat(user_datetime_str)
                # More robust parsing for different ISO 8601 formats, especially those with 'Z'
                if user_datetime_str.endswith('Z'):
                    user_datetime_str = user_datetime_str[:-1] + '+00:00'
                dt_object = datetime.fromisoformat(user_datetime_str)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid datetime format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SS.ffffffZ or with +/-HH:MM).",
                )

            # Ensure dt_object is offset-aware for comparison
            if dt_object.tzinfo is None or dt_object.tzinfo.utcoffset(dt_object) is None:
                 # Should not happen if fromisoformat worked as expected with +/-HH:MM or Z
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Datetime string must include timezone information.",
                )

            # Calculate the time difference between the user and server timestamps
            time_difference = abs(server_now_utc - dt_object)
            time_tolerance = timedelta(minutes=2)
            if time_difference > time_tolerance:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Your system date time is incorrect. Please correct it & try again.",
                )
        except HTTPException as http_exc:
            response= JSONResponse(
                status_code=http_exc.status_code, content={"detail": http_exc.detail}
            )
            response.headers["Access-Control-Allow-Origin"]="*"
            return response

        response = await call_next(request)
        return response