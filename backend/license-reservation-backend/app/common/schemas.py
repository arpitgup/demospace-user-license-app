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
from shared_lib.enums import ReservationStatus


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


class UpdateAppConfigRequest(CamelModel):
    configs: List[ConfigOut]


class LicenseActionRequest(CamelModel):
    reservation_id: int


class BotWithApplicationsOut(BotOut):
    applications: List[ApplicationOut]


class UpdateBotApplicationsRequest(CamelModel):
    application_ids: List[int]


class BotUpsertData(BaseModel):
    name: str
    email: EmailStr
    application_ids: List[int]


class BotsUpsertRequest(BaseModel):
    bots: list[BotUpsertData]


class ExtendReservationRequest(CamelModel):
    end_time: datetime

    _convert_to_utc = field_validator("end_time")(convert_to_utc)


class UpdateApplicationStatusRequest(CamelModel):
    is_active: bool
