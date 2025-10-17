from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel
from typing import List, Optional
from datetime import datetime, timezone
from shared_lib.enums import ReservationStatus, ApplicationLicenseType, DowntimeStatus


def convert_to_utc(v: datetime) -> datetime:
    """Convert a datetime to UTC, assuming naive datetimes are UTC."""
    if v.tzinfo is None:
        # If the datetime is naive, assume it's in UTC and attach timezone info.
        return v.replace(tzinfo=timezone.utc)
    # If it's timezone-aware, convert it to UTC.
    return v.astimezone(timezone.utc)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,  # (optional, for ORM mode)
    )


class ApplicationOut(CamelModel):
    id: int
    name: str
    is_active: bool


class AvailableBotInfo(CamelModel):
    id: int
    name: str
    email: str
    applications: List[ApplicationOut]


class AvailabilitySlot(CamelModel):
    start_time: datetime
    end_time: datetime
    available_bots: List[AvailableBotInfo]

    _convert_to_utc = field_validator("start_time", "end_time")(convert_to_utc)


class BotOut(CamelModel):
    id: int
    name: str
    email: str
    is_admin: bool
    created_at: datetime
    updated_at: datetime


class ConfigOut(CamelModel):
    key: str
    value: str
    description: Optional[str] = None


class ReservationOut(CamelModel):
    id: int
    user_email: str
    bot: BotOut
    applications: list[ApplicationOut]
    start_time: datetime
    end_time: datetime
    status: ReservationStatus

    _convert_to_utc = field_validator("start_time", "end_time")(convert_to_utc)


class AvailabilityByApplicationRequest(CamelModel):
    application_id: int
    start_time: datetime
    duration_hours: int = Field(gt=0)
    get_next_slots: bool = True

    _convert_to_utc = field_validator("start_time")(convert_to_utc)


class AvailabilityByApplicationResponse(CamelModel):
    requested_slot_available: bool
    is_downtime_conflict: bool
    next_available_slots: list[AvailabilitySlot]


class AvailabilityByDateRequest(CamelModel):
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def check_end_time(self):
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time.")
        return self

    _convert_to_utc = field_validator("start_time", "end_time")(convert_to_utc)


class AvailabilityByDateResponse(CamelModel):
    applications: List[ApplicationOut]


class AvailabilityByDateV2Response(CamelModel):
    available_bots: List[AvailableBotInfo]


class BulkCancelReservationsRequest(CamelModel):
    reservation_ids: List[int]


class BulkCancelReservationsResponse(CamelModel):
    successfully_cancelled: List[int]
    failed_to_cancel: List[int]

class CreateReservationRequest(CamelModel):
    primary_application_id: int
    secondary_application_ids: list[int] = []
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def check_end_time(self):
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time.")
        return self

    _convert_to_utc = field_validator("start_time", "end_time")(convert_to_utc)

class AdminCreateReservationRequest(CamelModel):
    primary_application_id: int
    secondary_application_ids: list[int] = []
    start_time: datetime
    end_time: datetime
    candidate_user_email: str

    @model_validator(mode="after")
    def check_end_time(self):
        if self.start_time >= self.end_time:
            raise ValueError("Start time must be before end time.")
        return self

    _convert_to_utc = field_validator("start_time", "end_time")(convert_to_utc)


class UpdateAppConfigRequest(CamelModel):
    configs: List[ConfigOut]


class LicenseActionRequest(CamelModel):
    reservation_id: int


class BotWithApplicationsOut(BotOut):
    applications: List[ApplicationOut]


class UpdateBotApplicationsRequest(CamelModel):
    application_ids: List[int]


class BotCreateData(BaseModel):
    name: str
    email: EmailStr
    application_ids: List[int]
    is_admin: bool

class BotsUpdateData(BaseModel):
    id: int    
    application_ids: List[int]
    is_admin: bool

class BotsCreateRequest(BaseModel):
    bots: list[BotCreateData]

class BotsUpdateRequest(BaseModel):
    bots: list[BotsUpdateData]

class ApplicationCreateRequest(BaseModel):
    name: str
    is_active: bool
    license_type: ApplicationLicenseType
    custom_SAML_attribute: Optional[str] = None
    license_group: str
    license_count: int    

class ApplicationCreateResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    license_type: ApplicationLicenseType
    custom_SAML_attribute: Optional[str] = None
    license_group: Optional[str] = None
    license_count: Optional[int] = None
    created_by: Optional[str] = None    

class ExtendReservationRequest(CamelModel):
    end_time: datetime

    _convert_to_utc = field_validator("end_time")(convert_to_utc)


class UpdateApplicationStatusRequest(CamelModel):
    is_active: bool


class ApplicationWithLicenseGroupOut(ApplicationOut):
    license_type: ApplicationLicenseType
    custom_SAML_attribute: Optional[str] = None
    license_group: Optional[str] = None
    license_count: Optional[int] = None
    license_assigned_to_Bots: int
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

class ApplicationUpdate(CamelModel):
    id: int
    name: str
    is_active: bool
    license_type: ApplicationLicenseType
    license_group: Optional[str] = None
    license_count: Optional[int] = None

class UpdateApplicationsRequest(CamelModel):
    applications: List[ApplicationUpdate]

class UserInfo(CamelModel):
    email: str
    given_name: str
    family_name: str
    full_name: str

class ApplicationDowntimeRequest(CamelModel):
    applications: List[int]
    downtime_start: datetime
    downtime_end: datetime
    downtime_reason: str

    _convert_to_utc = field_validator("downtime_start", "downtime_end")(convert_to_utc)

class ApplicationDowntimeOut(BaseModel):
    id: int
    application: ApplicationOut
    downtime_start: datetime
    downtime_end: datetime
    downtime_reason: str
    created_by: str
    status: DowntimeStatus

class DowntimeBulkCancelRequest(CamelModel):
    downtime_ids: List[int]

class DowntimeBulkCancelResponse(CamelModel):   
    successfully_cancelled: List[int]
    failed_to_cancel: List[int]

class RemoveAppFromReservationsRequest(CamelModel):
    primary_application_id: int
    secondary_application_ids: Optional[List[int]] = []

class UserValidationRequest(BaseModel):
    token: str

class UserDetails(BaseModel):
    user_token: str
    email: EmailStr
    name: str    
    is_present: bool

class UserValidationResponse(BaseModel):    
    token_valid: bool
    user_details: Optional[UserDetails] = None    

class UserInGroupRequest(BaseModel):
    """Schema for /add_user_to_group endpoint request."""
    group_email: EmailStr

class UserInGroupResponse(BaseModel):
    """Schema for /add_user_to_group endpoint response."""
    user_email: EmailStr
    group_email: EmailStr
    is_member: Optional[bool] = None
    message: Optional[str] = None

class CheckUserInWorkspaceRequest(BaseModel):
    """Generic schema for endpoints requiring only primary_email."""
    primary_email: EmailStr

class CheckUserInWorkspaceResponse(BaseModel):
    """Generic schema for endpoints requiring only primary_email."""
    is_exist: Optional[bool] = None
    primary_email: EmailStr
    secondary_email: EmailStr
    first_name: str
    last_name: str
    user_name: Optional[str] = None
    costCenter: Optional[str] = None
    jobTitle: Optional[str] = None
    department: Optional[str] = None
    orgUnitPath: Optional[str] = "/"
    demoName: Optional[str] = None
    managerEmail: Optional[EmailStr] = None

class CreateUserRequest(BaseModel):
    """Schema for /create_user endpoint."""
    primary_email: EmailStr
    secondary_email: EmailStr
    first_name: str
    last_name: str
    costCenter: str
    jobTitle: str
    department: str
    orgUnitPath: str = "/"
    demoName: str
    managerEmail: EmailStr

class CreateUserResponse(BaseModel):
    """Schema for /create_user endpoint."""
    primary_email: EmailStr
    secondary_email: EmailStr
    first_name: str
    last_name: str
    user_name: str
    costCenter: Optional[str] = None
    jobTitle: Optional[str] = None
    department: Optional[str] = None
    orgUnitPath: Optional[str] = "/"
    demoName: Optional[str] = None
    managerEmail: Optional[EmailStr] = None
    employeeID: Optional[str] = None
    password: str

class ResetPasswordRequest(BaseModel):
    """Schema for /reset_user_password endpoint."""
    primary_email: EmailStr

class ResetPasswordResponse(BaseModel):
    """Schema for /reset_user_password endpoint."""
    primary_email: EmailStr
    secondary_email: EmailStr
    first_name: str
    last_name: str
    costCenter: Optional[str] = None
    jobTitle: Optional[str] = None
    department: Optional[str] = None
    orgUnitPath: Optional[str] = "/"
    demoName: Optional[str] = None
    managerEmail: Optional[EmailStr] = None
    employeeID: Optional[str] = None
    password: str

class UpdateUserProfileRequestResponse(BaseModel):
    """Schema for useremail profile update endpoint."""
    primary_email: EmailStr
    orgUnitPath: Optional[str] = "/"
    department: Optional[str] = None
    jobTitle: Optional[str] = None
    costCenter: Optional[str] = None
    demoName: Optional[str] = None
    managerEmail: Optional[EmailStr] = None
    employeeID: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None