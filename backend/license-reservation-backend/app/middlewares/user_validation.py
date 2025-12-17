from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from ..common.constants import X_DEMO_USER_EMAIL_HEADER, X_GOG_AUTHENTICATED_USER_EMAIL
from loguru import logger

class UserValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            if request.method == "OPTIONS":
                return await call_next(request)
            # Skip swagger documentation endpoints
            if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json") or request.url.path.startswith("/auth"):
                return await call_next(request)            
            if (
                X-Goog-Authenticated-User-Email not in request.headers
                or not request.headers[X-Goog-Authenticated-User-Email]
            ):
                response = JSONResponse(
                    status_code=400,
                    content={"detail": "Missing X-Goog-Authenticated-User-Email header. Check if IAP is enabled."},
                )
                response.headers["Access-Control-Allow-Origin"]="*"
                return response
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Exception occured in user validation middleware: {e}")
            response = JSONResponse(
                status_code=500, content={"detail": str(e)}
            )
            response.headers["Access-Control-Allow-Origin"]="*"
            return response

# This is not required as now we are directly getting useremail from IAP & constructing user email for there only.
# def is_agentspace_demo_user(email: str, request: Request) -> bool:
#     if request.url.path.startswith("/admin") or request.url.path.startswith("/applications"):
#         return "@1987984870407.altostrat.com" in email
#     else:
#         return "-agentspace-demo-user@1987984870407.altostrat.com" in email

