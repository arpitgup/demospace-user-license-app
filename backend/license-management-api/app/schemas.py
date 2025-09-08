from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,  # (optional, for ORM mode)
    )


class ProvisionLicensesRequest(CamelModel):
    reservation_id: int

class DeprovisionLicensesRequest(CamelModel):
    reservation_id: int

class DowntimeEventRequest(CamelModel):
    downtime_id: int