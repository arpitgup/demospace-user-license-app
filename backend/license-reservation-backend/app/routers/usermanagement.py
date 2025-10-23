import random
import string
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from googleapiclient.errors import HttpError
from loguru import logger
from ..common.schemas import (
    UserInGroupRequest,
    UserInGroupResponse,
    CheckUserInWorkspaceResponse,
    CreateUserRequest,
    CreateUserResponse,
    ResetPasswordResponse,
    UpdateUserProfileRequestResponse
)
from shared_lib import admin_service
from shared_lib.dependencies import get_user_email, get_db, get_app_config
from ..utils.crud import generate_random_password, generate_employee_id

router = APIRouter(prefix="/user-management")

@router.get('/user-details', response_model=CheckUserInWorkspaceResponse)
async def check_user_in_workspace(    
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """Check User Existence API."""
    primary_email = user_email

    try:
        user_details = admin_service.get_user(primary_email)        
        if not user_details:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": f"User {primary_email} does not exist in workspace."}
        )
        return CheckUserInWorkspaceResponse(
            is_exist=True,
            primary_email=user_details.get("primaryEmail", "NA"),
            secondary_email=user_details.get("emails", [{}])[0].get("address", "NA"),
            first_name=user_details.get("name", {}).get("givenName", "NA"),
            last_name=user_details.get("name", {}).get("familyName", "NA"),
            user_name=user_details.get("name", {}).get("fullName", "NA"),
            costCenter=user_details.get("organizations", [{}])[0].get("costCenter", "NA"),
            jobTitle=user_details.get("organizations", [{}])[0].get("title", "NA"),
            department=user_details.get("organizations", [{}])[0].get("department", "NA"),
            orgUnitPath=user_details.get("orgUnitPath", "NA"),
            demoName=user_details.get("organizations", [{}])[0].get("name", "NA"),
            managerEmail=user_details.get("relations", [{}])[0].get("value", "NA")
        )   
    except Exception as e:
        logger.error(f"An unexpected error occurred during check user in workspace: {e}")        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during user check in workspace."
        )

@router.post('/create_user_in_workspace', response_model=CreateUserResponse)
async def create_user_in_workspace(
    req: CreateUserRequest,
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """Create User API."""
    
    password = generate_random_password()
    employee_id = generate_employee_id()
    
    user_info = {
        "name": {
            "givenName": req.first_name,
            "familyName": req.last_name
        },
        "password": password,
        "primaryEmail": req.primary_email,
        "orgUnitPath": req.orgUnitPath, 
        "changePasswordAtNextLogin": "true",
        "emails": [{
            "address": req.secondary_email,
            "type": "work"
        }],
        "externalIds": [{
            "type": "organization",
            "value": employee_id
        }],
        "organizations": [{
            "department": req.department,
            "title": req.jobTitle,
            "type": "work",
            "costCenter": req.costCenter,
            "description": "Employee",
            "name": req.demoName,
        }],
        "relations": [{
            "type": "manager",
            "value": req.managerEmail
        }            
        ],
    }
    
    if req.managerEmail is None:
        user_info["relations"] = []

    try:
        user_details = admin_service.create_user(user_info)
        if not user_details:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user in workspace."
            )
        return CreateUserResponse(
            primary_email=user_details.get("primaryEmail", "NA"),
            secondary_email=user_details.get("emails", [{}])[0].get("address", "NA"),
            first_name=user_details.get("name", {}).get("givenName", "NA"),
            last_name=user_details.get("name", {}).get("familyName", "NA"),
            user_name=user_details.get("name", {}).get("fullName", "NA"),
            costCenter=user_details.get("organizations", [{}])[0].get("costCenter", "NA"),
            jobTitle=user_details.get("organizations", [{}])[0].get("title", "NA"),
            department=user_details.get("organizations", [{}])[0].get("department", "NA"),
            orgUnitPath=user_details.get("orgUnitPath", "NA"),
            demoName=user_details.get("organizations", [{}])[0].get("name", "NA"),
            managerEmail=user_details.get("relations", [{}])[0].get("value", "NA"),
            employeeID=employee_id,
            password=password
        )
    
    except Exception as e:
        logger.error(f"An unexpected error occurred during user creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="An unexpected error occurred during user creation."
        )

@router.post('/check_user_in_group', response_model=UserInGroupResponse)
async def check_user_in_group(
    req: UserInGroupRequest,
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """
    Checks if a specific user is a member of a specific Google Group.
    """
    primary_email = user_email
    group_email = req.group_email

    try:
        is_member = admin_service.is_user_in_group(primary_email, group_email)            
        return UserInGroupResponse(
            user_email=user_email,
            group_email=group_email,
            is_member=is_member
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during user group check."
        )

@router.post('/adding_user_to_group', response_model=UserInGroupResponse)
async def adding_user_to_group(
    req: UserInGroupRequest,
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config),
    ):
    """Adds a user to a Google Workspace group."""    
    group_email = req.group_email
    try:
        admin_service.add_user_to_group(user_email, group_email)
        logger.info(f"Successfully added {user_email} to {group_email}.")
        return UserInGroupResponse(
            user_email=user_email,
            group_email=group_email,
            is_member=True,
            message=f"Successfully added {user_email} to {group_email}."
        )
    except Exception as e:
            logger.error(f"An unexpected error occurred while adding {user_email} in {group_email}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during user group check."
            )

@router.post('/remove_user_from_group', response_model=UserInGroupResponse)
async def remove_user_from_group(
    req: UserInGroupRequest,
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """Removes a user from a Google Workspace group."""
    group_email = req.group_email
    try:        
        admin_service.remove_user_from_group(user_email, group_email)
        logger.info(f"Successfully removed {user_email} from {group_email}.")
        return UserInGroupResponse(
            user_email=user_email,
            group_email=group_email,
            is_member=False,
            message=f"Successfully removed {user_email} from {group_email}."
        )
    except Exception as e:
            logger.error(f"An unexpected error occurred while removing {user_email} from {group_email}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during user group check."
            )

@router.post('/get_user_current_profile', response_model=CheckUserInWorkspaceResponse)
async def get_user_current_profile(    
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """Get current User profile API."""
    primary_email = user_email

    try:
        user_details = admin_service.get_user_details(primary_email)
        return CheckUserInWorkspaceResponse(
            is_exist=True,
            primary_email=user_details.get("primaryEmail", "NA"),
            secondary_email=user_details.get("emails", [{}])[0].get("address", "NA"),
            first_name=user_details.get("name", {}).get("givenName", "NA"),
            last_name=user_details.get("name", {}).get("familyName", "NA"),
            user_name=user_details.get("name", {}).get("fullName", "NA"),
            costCenter=user_details.get("organizations", [{}])[0].get("costCenter", "NA"),
            jobTitle=user_details.get("organizations", [{}])[0].get("title", "NA"),
            department=user_details.get("organizations", [{}])[0].get("department", "NA"),
            orgUnitPath=user_details.get("orgUnitPath", "NA"),
            demoName=user_details.get("organizations", [{}])[0].get("name", "NA"),
            managerEmail=user_details.get("relations", [{}])[0].get("value", "NA")
        )
    except Exception as e:
            logger.error(f"An unexpected error occurred while get user {user_email} current profile: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while getting user current profile."
            )

@router.post('/reset_user_password', response_model=ResetPasswordResponse)
async def reset_user_password(
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """Reset User Password API."""
    primary_email = user_email

    try:
        password = generate_random_password()
        
        existing_user = admin_service.get_user_details(primary_email)
        employee_id = "NA"
        if "externalIds" in existing_user:
            for external_id in existing_user["externalIds"]:
                if external_id.get("type") == "organization":
                    employee_id = external_id.get("value", "NA")
                    break

        updated_user_info = {"password": password}
        admin_service.update_user_profile_with_new_info(primary_email, updated_user_info)
        return ResetPasswordResponse(
            primary_email=primary_email,
            secondary_email=existing_user.get("emails", [{}])[0].get("address", "NA"),
            first_name=existing_user.get("name", {}).get("givenName", "NA"),
            last_name=existing_user.get("name", {}).get("familyName", "NA"),
            costCenter=existing_user.get("organizations", [{}])[0].get("costCenter", "NA"),
            jobTitle=existing_user.get("organizations", [{}])[0].get("title", "NA"),
            department=existing_user.get("organizations", [{}])[0].get("department", "NA"),
            orgUnitPath=existing_user.get("orgUnitPath", "NA"),
            demoName=existing_user.get("organizations", [{}])[0].get("name", "NA"),
            managerEmail=existing_user.get("relations", [{}])[0].get("value", "NA"),
            employeeID=employee_id,
            password=password
        )

    except Exception as e:
        logger.error(f"An unexpected error occurred during user password reset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="An unexpected error occurred during user password reset."
        )

@router.post('/update_user_profile', response_model=UpdateUserProfileRequestResponse)
async def update_user_profile(
    req: UpdateUserProfileRequestResponse,
    user_email: str = Depends(get_user_email),
    app_config: dict = Depends(get_app_config)
    ):
    """Update User Profile API."""
    primary_email = user_email
    orgUnitPath = req.orgUnitPath
    department = req.department
    jobTitle = req.jobTitle
    costCenter = req.costCenter
    demoName = req.demoName
    managerEmail = req.managerEmail

    try:
        existing_user = admin_service.get_user_details(primary_email)
        
        updated_user_info = {
            "orgUnitPath": req.orgUnitPath,
            "organizations": [{
                "department": req.department,
                "title": req.jobTitle,
                "type": "work",
                "costCenter": req.costCenter,
                "description": "Employee",
                "name": req.demoName,
            }],
            "relations": [{
                "type": "manager",
                "value": req.managerEmail
            }],
        }
        
        payload = {k: v for k, v in updated_user_info.items() if v is not None}
        
        if req.managerEmail is None:
            payload["relations"] = []

        admin_service.update_user_profile_with_new_info(primary_email, payload)
        
        employeeID = existing_user.get("externalIds", [{}])[0].get("value", "NA")
        first_name = existing_user.get("name", {}).get("givenName", "NA")
        last_name = existing_user.get("name", {}).get("familyName", "NA")

        return UpdateUserProfileRequestResponse(
            primary_email=primary_email,
            orgUnitPath=orgUnitPath,
            department=department,
            jobTitle=jobTitle,
            costCenter=costCenter,
            demoName=demoName,
            managerEmail=managerEmail,
            employeeID=employeeID,
            first_name=first_name,
            last_name=last_name
        )
            
    except Exception as e:
        logger.error(f"An unexpected error occurred during user profile update: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="An unexpected error occurred during user profile update."
        )