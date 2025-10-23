from fastapi import Header, HTTPException, Depends

from .db.models import AppConfig
from .db.session import SessionLocal
import requests
import time
from jose import jwt
import sys
from typing import Dict, Any, Optional
from functools import lru_cache
from loguru import logger

# EXPECTED_AUDIENCE = "/projects/385039775654/global/backendServices/3364462286488655023"
# IAP_ISSUER = 'https://cloud.google.com/iap'
# IAP_PUBLIC_KEYS_URL = 'https://www.gstatic.com/iap/verify/public_key'

# @lru_cache(maxsize=1)
# def get_iap_certs() -> Dict[str, Any]:
#     """
#     Returns a dictionary of current Google public key certificates.
#     Uses lru_cache to cache the result on first request.
#     """
#     try:
#         response = requests.get(IAP_PUBLIC_KEYS_URL, timeout=5)
#         response.raise_for_status()
#         return response.json()
#     except requests.RequestException as e:
#         print(f"Failed to fetch IAP public keys: {e}", file=sys.stderr)
#         raise RuntimeError("Failed to fetch IAP public keys.")


def get_db():
    """Dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_user_email(x_demo_user_email: str = Header(...)):
    """Dependency to get the custom user email header."""
    if not x_demo_user_email:
        raise HTTPException(status_code=400, detail="Missing X-Demo-User-Email")
    return x_demo_user_email

async def get_user_current_time(x_user_current_time: str = Header(...)):
    """Dependency to get the custom user current time header."""
    if not x_user_current_time:
        raise HTTPException(status_code=400, detail="Missing X-User-Current-Time")
    return x_user_current_time

async def get_user_token(x_user_token: str = Header(...)):
    """Dependency to get the custom user token header."""
    if not x_user_token:
        raise HTTPException(status_code=400, detail="Missing X-User-Current-Time")
    return x_user_token

# async def get_authenticated_iap_user_email(
#     x_goog_iap_jwt_assertion: str
# ) -> str:
#     """
#     Decodes, verifies the IAP JWT, and returns the user's email.
#     """
#     logger.info(f"X-Goog-IAP-JWT-Assertion: {x_goog_iap_jwt_assertion}")
#     if not x_goog_iap_jwt_assertion:
#         raise HTTPException(
#             status_code=401, 
#             detail="Missing X-Goog-IAP-JWT-Assertion header."
#         )

#     try:
#         certs = get_iap_certs()
        
#         info = jwt.decode(
#             x_goog_iap_jwt_assertion,
#             certs,
#             algorithms=['ES256'],
#             audience=EXPECTED_AUDIENCE,
#             issuer=IAP_ISSUER,
#             options={"verify_signature": True, "verify_aud": True, "verify_iss": True}
#         )
#         logger.info(f"UserEmail Info: {info}")
#         email = info.get('email')
#         logger.info(f"UserEmail Info: {email}")
#         if not email:
#             raise ValueError("JWT payload missing 'email' claim.")
            
#         return email
        
#     except jwt.InvalidSignatureError:
#         raise HTTPException(status_code=401, detail="Invalid JWT signature. IAP integrity compromised.")
#     except jwt.ExpiredSignatureError:
#         raise HTTPException(status_code=401, detail="Expired JWT token.")
#     except jwt.InvalidAudienceError:
#         raise HTTPException(status_code=500, detail="JWT Audience mismatch. Check EXPECTED_AUDIENCE configuration.")
#     except Exception as e:
#         print(f"IAP JWT Validation Failed: {e}", file=sys.stderr)
#         raise HTTPException(status_code=500, detail=f"Authentication error.")

app_config = {}


def get_app_config():
    """Dependency to fetch application configuration from database."""
    global app_config
    if not app_config:
        app_config = {}
        with SessionLocal() as db:
            configs = db.query(AppConfig).all()
            for config in configs:
                app_config[config.key] = (
                    int(config.value) if config.value.isdigit() else config.value
                )
    return app_config


def refresh_app_config():
    """Clear the cached application configuration."""
    global app_config
    app_config = {}
    get_app_config()