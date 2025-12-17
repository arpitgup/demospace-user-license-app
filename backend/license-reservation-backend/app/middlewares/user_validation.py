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
            print(f"Request headers: {request.headers}")
            IAP_Header = request.headers.get(X-Goog-Authenticated-User-Email)
            print(f"IAP_Header: {IAP_Header}")

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

            user_email = request.headers.get(X-Goog-Authenticated-User-Email)
            print(f"user_email: {user_email}")

            try:
                demouser_email = construct_demouser_email(user_email)
                print(f"demouser_email: {demouser_email}")
                if not demouser_email:
                    raise HTTPException(
                        status_code=401, detail=f"Consructed demo user email failed for user {user_email}."
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

# This is not required as now we are directly getting useremail from IAP & constructing user email for there only.
# def is_agentspace_demo_user(email: str, request: Request) -> bool:
#     if request.url.path.startswith("/admin") or request.url.path.startswith("/applications"):
#         return "@1987984870407.altostrat.com" in email
#     else:
#         return "-agentspace-demo-user@1987984870407.altostrat.com" in email

def construct_demouser_email(user_email_input):
    """
    Takes an input like 'accounts.google.com:ldap@google.com',
    extracts the LDAP (username), and returns a new demo email address.
    """
    try:
        ldap = user_email_input.split(':')[1].split('@')[0]
        demouser_email = f"{ldap}-agentspace-demo-user@1987984870407.altostrat.com"
        return demouser_email
    except IndexError:
        return "Invalid input format. Expected 'provider:user@domain.com'"