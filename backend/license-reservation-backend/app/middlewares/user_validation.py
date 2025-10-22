from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from ..common.constants import X_DEMO_USER_EMAIL_HEADER, X_GOG_AUTHENTICATED_USER_EMAIL
from loguru import logger
from shared_lib.dependencies import get_authenticated_iap_user_email

class UserValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            logger.info(f"Request headers: {request.headers}")
            jwt_token = request.headers.get('x-goog-iap-jwt-assertion')
            user_data=request.headers.get('x-goog-authenticated-user-email')
            logger.info(f"Google Email: {user_data}")
            userEmail = await get_authenticated_iap_user_email(jwt_token)
            # request.headers[X_GOG_AUTHENTICATED_USER_EMAIL] = userEmail
            logger.info(f"User Email: {userEmail}")
            
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

            if (
                X_GOG_AUTHENTICATED_USER_EMAIL not in request.headers
                or not request.headers[X_GOG_AUTHENTICATED_USER_EMAIL]
            ):
                response = JSONResponse(
                    status_code=400,
                    content={"detail": "Missing X_GOG_AUTHENTICATED_USER_EMAIL header."},
                )
                response.headers["Access-Control-Allow-Origin"]="*"
                return response

            user_email = request.headers.get(X_DEMO_USER_EMAIL_HEADER)
            try:
                # user = admin_service.get_user(user_email)
                is_valid_email = is_agentspace_demo_user(user_email, request)
                if not is_valid_email:
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


def is_agentspace_demo_user(email: str, request: Request) -> bool:
    if request.url.path.startswith("/admin") or request.url.path.startswith("/applications"):
        return "@1987984870407.altostrat.com" in email
    else:
        return "-agentspace-demo-user@1987984870407.altostrat.com" in email