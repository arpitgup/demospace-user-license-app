from enum import Enum


class ReservationStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class ApplicationLicenseType(str, Enum):
    SUBSCRIPTION = "SUBSCRIPTION"
    ENVIRONMENT = "ENVIRONMENT"
    API_MANAGED = "API_MANAGED"

class DowntimeStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class DemoOnboardingStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DEPRECATED = "DEPRECATED"