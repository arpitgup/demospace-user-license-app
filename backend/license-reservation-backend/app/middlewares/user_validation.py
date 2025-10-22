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
import requests
import json
from google.auth.jwt import decode
from google.auth import exceptions

# EXPECTED_AUDIENCE = "/projects/385039775654/global/backendServices/3364462286488655023"
# IAP_ISSUER = "https://cloud.google.com/iap"
IAP_PUBLIC_KEY_URL = "https://www.gstatic.com/iap/verify/public_key"
IAP_AUDIENCE = "/projects/385039775654/global/backendServices/3364462286488655023"
_iap_public_keys = {}

def get_iap_public_keys():
    """Fetches and caches Google IAP public keys."""
    global _iap_public_keys
    if not _iap_public_keys:
        try:
            response = requests.get(IAP_PUBLIC_KEY_URL, timeout=5)
            response.raise_for_status()
            _iap_public_keys = response.json()
        except requests.RequestException as e:
            print(f"Error fetching IAP public keys: {e}")
            raise HTTPException(status_code=500, detail="Could not fetch IAP verification keys.")
    return _iap_public_keys

def get_authenticated_email_google_auth(
    request
) -> str:
   
    try:
        if not request.headers.get(X_GOG_AUTHENTICATED_USER_EMAIL):
            logger.info("Not a user email========")
            return ''
        public_keys = get_iap_public_keys()
        jwt_assertion = request.headers.get(X_GOG_AUTHENTICATED_USER_EMAIL)
        claims = decode(
            jwt_assertion,
            certs=public_keys,
            audience=IAP_AUDIENCE,
            # The IAP JWT uses the ES256 algorithm
            # verify_claims=['exp', 'iat', 'aud', 'iss'] 
        )
        tokenDecoded=jwt.decode(request.headers.get(X_GOG_AUTHENTICATED_USER_EMAIL),verify=False)
        logger.info(f"tokenDecoded email========: {tokenDecoded}") 
        logger.info(f"User email Decoded========: {claims}")
        user_email = claims.get('email')
        logger.info(f"User email========: {user_email}")


       
        if user_email:
            return str(user_email)
        else :
            return '' 

            
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
            if(X_GOG_AUTHENTICATED_USER_EMAIL in request.headers):
                 logger.info(f"User email from header: {get_authenticated_email_google_auth(request)}")

        
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
                user_email = request.headers.get(X_DEMO_USER_EMAIL_HEADER)
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