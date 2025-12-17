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
                    content={"detail": "Missing X-Goog-Authenticated-User-Email header."},
                )
                response.headers["Access-Control-Allow-Origin"]="*"
                return response

            user_email = request.headers.get(X-Goog-Authenticated-User-Email)
            logger.info("=============================")
            logger.info("=============================")
            logger.info("=============================")
            logger.info(user_email)
            logger.info("=============================")
            logger.info("=============================")
            logger.info("=============================")
            try:
                demouser_email = construct_demo_user_email(user_email)
                if not demouser_email:
                    raise HTTPException(
                        status_code=401, detail=f"Consructed demo user email failed for user {user_email}."
                    )

                # is_valid_email = is_agentspace_demo_user(user_email, request)
                # if not is_valid_email:
                #     raise HTTPException(
                #         status_code=401, detail=f"User {user_email} is not valid."
                #     )

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

# Received value 'X-Goog-Authenticated-User-Email' i.e. accounts.google.com:example@gmail.com
# Take ldap 'example' & change it to 'example-agentspace-demo-user@1987984870407.altostrat.com'
def construct_demo_user_email(email: str) -> str:
    try:
        local_part = email.split('@')[0]
        dash_index = local_part.find('-')

        if dash_index != -1:
            return local_part[:dash_index] + "-agentspace-demo-user@1987984870407.altostrat.com"
        else:
            return ""

    except IndexError:
        return ""