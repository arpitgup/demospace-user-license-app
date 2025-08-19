from enum import Enum


class ReservationStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ApplicationLicenseType(str, Enum):
    SUBSCRIPTION = "SUBSCRIPTION"
    ENVIRONMENT = "ENVIRONMENT"
