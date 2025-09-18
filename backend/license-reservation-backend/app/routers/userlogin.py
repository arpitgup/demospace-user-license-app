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
from ..common.constants import ALTOSTRAT_CLIENT_ID
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
    
    username = user_email.split('@')[0]
    altostrat_email = f"{username}-agentspace-demo-user@1987984870407.altostrat.com"    
    
    try:
        user = admin_service.get_user(altostrat_email)
        print(user)
        if not user:        
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": f"User {altostrat_email} is not valid."}
        )
            
        given_name = user.get('name', {}).get('givenName', '')
        family_name = user.get('name', {}).get('familyName', '')
        username = f"{given_name} {family_name}".strip()

        db_user = db.query(User).filter(User.email == altostrat_email).one_or_none()
        
        if not db_user:
            logger.info(f"User {altostrat_email} not found in DB.")
            new_user = User(name=username, email=altostrat_email)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            db_user = new_user            
            logger.info(f"User created with ID {db_user.id}.")
        else:
            logger.info(f"User {altostrat_email} already exists in DB.")
        
        user_details = UserDetails(
            email=altostrat_email,
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