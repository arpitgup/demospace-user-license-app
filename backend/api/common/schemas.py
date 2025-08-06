from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from typing import List
from datetime import datetime
from .enums import ReservationStatus


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,  # (optional, for ORM mode)
    )


class ApplicationOut(CamelModel):
    id: int
    name: str


class AvailableBotInfo(CamelModel):
    id: int
    name: str
    email: str
    applications: List[ApplicationOut]


class AvailabilitySlot(CamelModel):
    start_time: datetime
    end_time: datetime
    available_bots: List[AvailableBotInfo]


class BotOut(CamelModel):
    id: int
    name: str
    email: str


class ConfigOut(CamelModel):
    key: str
    value: str
    description: str


class ReservationOut(CamelModel):
    id: int
    user_email: str
    bot: BotOut
    applications: list[ApplicationOut]
    start_time: datetime
    end_time: datetime
    status: ReservationStatus


class AvailabilityByApplicationRequest(CamelModel):
    application_id: int
    start_time: datetime
    duration_hours: int = Field(gt=0)
    get_next_slots: bool = True


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


class UpdateAppConfigRequest(CamelModel):
    configs: List[ConfigOut]


class LicenseActionRequest(CamelModel):
    reservation_id: int
