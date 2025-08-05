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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from .enums import ReservationStatus, TaskType


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
    value = Column(Boolean)
    description = Column(String)


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

    supported_by_bots = relationship("BotApplication", back_populates="application")
    reservations = relationship(
        "Reservation",
        secondary=reservation_applications_table,
        back_populates="applications",
    )


class Bot(Base):
    __tablename__ = "bots"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)

    reservations = relationship("Reservation", back_populates="bot")
    supported_applications = relationship(
        "BotApplication", back_populates="bot", lazy="joined"
    )


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


class Reservation(Base):
    __tablename__ = "reservations"
    id = Column(BigInteger, primary_key=True)
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
