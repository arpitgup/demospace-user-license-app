from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse

from ..common.constants import X_DEMO_USER_EMAIL_HEADER


# class UserValidationMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         if request.method == "OPTIONS":
#             return await call_next(request)

#         # Skip swagger documentation endpoints
#         if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
#             return await call_next(request)

#         if (
#             X_DEMO_USER_EMAIL_HEADER not in request.headers
#             or not request.headers[X_DEMO_USER_EMAIL_HEADER]
#         ):
#             response = JSONResponse(
#                 status_code=400,
#                 content={"detail": "Missing X-Demo-User-Email header."},
#             )
#             response.headers["Access-Control-Allow-Origin"]="*"  
#             return response

#         user_email = request.headers.get(X_DEMO_USER_EMAIL_HEADER)
#         try:
#             user = admin_service.get_user(user_email)
#             if not user:
#                 raise HTTPException(
#                     status_code=401, detail=f"User {user_email} is not valid."
#                 )

#         except HTTPException as http_exc:
#             response = JSONResponse(
#                 status_code=http_exc.status_code, content={"detail": http_exc.detail}
#             )
#             response.headers["Access-Control-Allow-Origin"]="*"
#             return response

#         response = await call_next(request)
#         return response

EXCLUDE_PATHS = (
    "/docs",
    "/openapi.json",
    "/auth",
)

class UserValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        
        if request.url.path.startswith(EXCLUDE_PATHS):
            return await call_next(request)

        if (
            X_DEMO_USER_EMAIL_HEADER not in request.headers
            or not request.headers[X_DEMO_USER_EMAIL_HEADER]
        ):
            response = JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": f"Missing {X_DEMO_USER_EMAIL_HEADER} header."},
            )
            response.headers["Access-Control-Allow-Origin"]="*"
            return response

        user_email = request.headers.get(X_DEMO_USER_EMAIL_HEADER)
        try:
            # Assuming admin_service.get_user raises an exception or returns None/False
            # if the user is not found or invalid.
            user = admin_service.get_user(user_email)
            if not user: # Or appropriate check based on what get_user returns
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail=f"User {user_email} is not valid."
                )

        except HTTPException as http_exc:
            response = JSONResponse(
                status_code=http_exc.status_code, content={"detail": http_exc.detail}
            )
            response.headers["Access-Control-Allow-Origin"]="*"
            return response
        except Exception as e:
            # Catch any other potential errors from admin_service.get_user
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": f"Error validating user: {str(e)}"},
            )
            response.headers["Access-Control-Allow-Origin"]="*"
            return response

        response = await call_next(request)
        return response