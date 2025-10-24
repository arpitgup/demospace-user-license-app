from datetime import datetime, timezone
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Table,
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from ..enums import ReservationStatus, ApplicationLicenseType, DowntimeStatus



Base = declarative_base()


reservation_applications_table = Table(
    "reservation_applications",
    Base.metadata,
    Column(
        "reservation_id", BigInteger, ForeignKey("reservations.id"), primary_key=True
    ),
    Column("application_id", Integer, ForeignKey("applications.id"), primary_key=True),
)


class AppConfig(Base):
    __tablename__ = "app_config"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    description = Column(String)


class BotApplication(Base):
    __tablename__ = "bot_applications"
    bot_id = Column(Integer, ForeignKey("bots.id"), primary_key=True)
    application_id = Column(
        Integer, ForeignKey("applications.id"), primary_key=True, index=True
    )

    bot = relationship("Bot", back_populates="supported_applications")
    application = relationship(
        "Application", back_populates="supported_by_bots", lazy="joined"
    )


bot_applications_table = Table(
    "bot_applications",
    Base.metadata,
    Column("bot_id", Integer, ForeignKey("bots.id"), primary_key=True),
    Column("application_id", Integer, ForeignKey("applications.id"), primary_key=True),
    extend_existing=True,
)


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    license_type = Column(
        PGEnum(ApplicationLicenseType), default=ApplicationLicenseType.SUBSCRIPTION
    )
    custom_SAML_attribute = Column(String, nullable=False)
    license_group = Column(String, nullable=True)
    license_count = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))    
    created_by = Column(String, nullable=False)

    supported_by_bots = relationship("BotApplication", back_populates="application")
    reservations = relationship(
        "Reservation",
        secondary=reservation_applications_table,
        back_populates="applications",
    )
    bots = relationship(
        "Bot",
        secondary=bot_applications_table,
        back_populates="applications",
        viewonly=True,
    )


class Bot(Base):
    __tablename__ = "bots"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

    reservations = relationship("Reservation", back_populates="bot")
    supported_applications = relationship(
        "BotApplication", back_populates="bot", lazy="joined"
    )
    applications = relationship(
        "Application",
        secondary=bot_applications_table,
        back_populates="bots",
        viewonly=True,
    )


class Reservation(Base):
    __tablename__ = "reservations"
    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    user_email = Column(String, nullable=False, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), index=True)
    primary_application_id = Column(Integer, ForeignKey("applications.id"))
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    status = Column(
        PGEnum(ReservationStatus), default=ReservationStatus.PENDING, index=True
    )
    provisioning_task_id = Column(String, nullable=True)
    deprovisioning_task_id = Column(String, nullable=True)

    bot = relationship("Bot", back_populates="reservations")
    applications = relationship(
        "Application",
        secondary=reservation_applications_table,
        back_populates="reservations",
        lazy="joined",
    )

class ApplicationDowntime(Base):
    __tablename__ = "application_downtime"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    downtime_start = Column(DateTime(timezone=True), nullable=False)
    downtime_end = Column(DateTime(timezone=True), nullable=False)
    downtime_reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), nullable=False)
    created_by = Column(String, nullable=False)
    status = Column(
        PGEnum(DowntimeStatus), default=DowntimeStatus.PENDING, index=True
    )
    start_task_id = Column(String, nullable=True)
    end_task_id = Column(String, nullable=True)

    application = relationship("Application")

# Not in use
# class User(Base):
#     __tablename__ = "users"    
#     id = Column(Integer, primary_key=True)
#     name = Column(String(255))
#     email = Column(String(255), unique=True)

class RepresentativeProfile(Base):
    __tablename__ = "representative_profile"
    
    # *** THIS IS THE CRITICAL LINE TO FIX THE MAPPER ERROR ***
    # It tells SQLAlchemy that this primary key is also a foreign key referencing the other table.
    demo_id = Column(String(10), ForeignKey("demo_details.demo_id"), primary_key=True)
    
    cost_centre = Column(String(20))
    manager_name = Column(String(100), nullable=False)
    manager_email = Column(String(255), nullable=False)
    manager_title = Column(String(100))
    rep_role = Column(String(100))
    rep_department = Column(String(50))
    org_unit = Column(String(100))

    # The relationship is now automatically determined by the ForeignKey above
    demo = relationship("DemoDetail", back_populates="representative_profile", uselist=False)

class DemoDetail(Base):
    __tablename__ = "demo_details"
    
    demo_id = Column(String(10), primary_key=True)
    demo_title = Column(String(255), unique=True, nullable=False)
    # ... (other columns)
    
    demo_user_group_email = Column(String(255))
    gemini_enterprise_app_link = Column(String) 
    drive_folder_link = Column(String)
    feedback_bug_link = Column(String)
    demo_onboarding_status = Column(String(50))
    feature_license_app = Column(Boolean)

    # The back-reference relationship is also correct.
    representative_profile = relationship(
        "RepresentativeProfile",
        back_populates="demo",
        uselist=False
    )