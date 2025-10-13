from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from loguru import logger
from google.auth.transport import requests
from google.oauth2 import id_token
from googleapiclient.discovery import build
import os

from shared_lib.db.models import (
   User
)
from shared_lib.dependencies import get_app_config, get_db
from sqlalchemy.orm import Session
from ..common.constants import ALTOSTRAT_CLIENT_ID, LICENSE_APP_ADMIN_GROUP_EMAIL
from shared_lib import admin_service
from ..common.schemas import (
    UserValidationRequest,
    UserDetails,
    UserValidationResponse,
)

router = APIRouter()

@router.post("/auth/user/login", response_model=UserValidationResponse, status_code=status.HTTP_200_OK)
def validate_user(
    request: UserValidationRequest,
    db: Session = Depends(get_db),
    app_config: dict = Depends(get_app_config),
    ):
    """
    Validates a token, transforms the user's email, and checks for existence in altostrat workspace.
    """
    token = request.token    
    user_email = None
    
    try:        
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), app_config[ALTOSTRAT_CLIENT_ID])
        user_email = idinfo.get('email')        
        if not user_email:
            return UserValidationResponse(
                token_valid=False,
                user_details=None
            )

    except ValueError:        
        return UserValidationResponse(
            token_valid=False,
            user_details=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during token validation: {e}"
        )
    
    try:
        user = admin_service.get_user(user_email)        
        if not user:        
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": f"User {user_email} is not valid."}
        )
            
        given_name = user.get('name', {}).get('givenName', '')
        family_name = user.get('name', {}).get('familyName', '')
        username = f"{given_name} {family_name}".strip()

        # New Check if user belongs to admin group or not
        try:
            if not admin_service.is_user_in_group(user_email, app_config[LICENSE_APP_ADMIN_GROUP_EMAIL]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"User {user_email} is not authorized to perform this operation.",
                )

        except HTTPException as http_exc:
            return JSONResponse(
                status_code=http_exc.status_code, content={"detail": http_exc.detail}
            )
        
        user_details = UserDetails(
            email=user_email,
            name=username,
            is_present=True
        )
        return UserValidationResponse(
            token_valid=True,
            user_details=user_details
        )
            
    except Exception as e:
        db.rollback()
        logger.error(
            f"An unexpected error occurred during application status update: {e}"
        )
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )