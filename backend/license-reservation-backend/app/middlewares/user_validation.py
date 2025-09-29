from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse

from ..common.constants import X_DEMO_USER_EMAIL_HEADER
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
                X_DEMO_USER_EMAIL_HEADER not in request.headers
                or not request.headers[X_DEMO_USER_EMAIL_HEADER]
            ):
                response = JSONResponse(
                    status_code=400,
                    content={"detail": "Missing X-Demo-User-Email header."},
                )
                response.headers["Access-Control-Allow-Origin"]="*"  
                return response

            user_email = request.headers.get(X_DEMO_USER_EMAIL_HEADER)
            try:
                user = admin_service.get_user(user_email)
                if not user:
                    raise HTTPException(
                        status_code=401, detail=f"User {user_email} is not valid."
                    )

            except HTTPException as http_exc:
                response = JSONResponse(
                    status_code=http_exc.status_code, content={"detail": http_exc.detail}
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