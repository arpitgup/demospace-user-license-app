from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from ..common.constants import X_GOG_AUTHENTICATED_USER_EMAIL
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
                X_GOG_AUTHENTICATED_USER_EMAIL not in request.headers
                or not request.headers[X_GOG_AUTHENTICATED_USER_EMAIL]
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

