from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from shared_lib import admin_service
from starlette.responses import JSONResponse
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from ..common.constants import X_DEMO_USER_EMAIL_HEADER, X_GOG_AUTHENTICATED_USER_EMAIL
from loguru import logger
# iap_auth.py
# import os
# from fastapi import Header, HTTPException, status, Depends
# from google.oauth2 import id_token
# from google.auth.transport import requests
# from google.auth.exceptions import InvalidValue, GoogleAuthError
# from typing import Optional
from google.auth import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

EXPECTED_AUDIENCE = "/projects/385039775654/global/backendServices/3364462286488655023"
IAP_ISSUER = "https://cloud.google.com/iap"
IAP_PUBLIC_KEY_URL = "https://www.gstatic.com/iap/verify/public_key"


def get_authenticated_email_google_auth(
    request
) -> str:
   
    try:
        if not request.headers.get(X_GOG_AUTHENTICATED_USER_EMAIL):
            logger.info("Not a user email========")
            return ''
        

        req=google_requests.Request()       
        decoded=id_token.verify_token(request.headers.get(X_GOG_AUTHENTICATED_USER_EMAIL),req,audience=EXPECTED_AUDIENCE)
        logger.info(f"User email========: {decoded}")
        user_email=decoded.get("email")
        logger.info(f"User email========: {user_email}")
        return ''
        # user_email = de

       
        # if user_email:
        #     return str(user_email)
            
        # raise ValueError("Token did not contain an email claim.")

    except Exception as e:
        print(f"IAP JWT Validation Failed: {e}")
        raise HTTPException(
            status_code=404, 
            detail="Invalid IAP JWT Assertion."
        )


class UserValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            logger.info(f"Request headers: {request.headers}")
            if(X_GOG_AUTHENTICATED_USER_EMAIL not in request.headers
                or not request.headers[X_DEMO_USEX_GOG_AUTHENTICATED_USER_EMAILR_EMAIL_HEADER]):
                 logger.info(f"Request Headers===: {get_authenticated_email_google_auth(request)}")

        
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