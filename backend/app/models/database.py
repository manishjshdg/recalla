"""
Database models and setup using SQLAlchemy async.
"""
from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Float, DateTime, Boolean,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import get_settings
import enum


class IncidentStatus(str, enum.Enum):
    DETECTED = "detected"
    ACKNOWLEDGED = "acknowledged"
    INVESTIGATING = "investigating"
    MITIGATING = "mitigating"
    RESOLVED = "resolved"
    POST_MORTEM = "post_mortem"


class Severity(str, enum.Enum):
    SEV1 = "SEV-1"
    SEV2 = "SEV-2"
    SEV3 = "SEV-3"
    SEV4 = "SEV-4"
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Base(DeclarativeBase):
    pass


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    incident_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    service: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(30), default=IncidentStatus.DETECTED.value)
    symptoms: Mapped[str] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_component: Mapped[str | None] = mapped_column(String(200), nullable=True)
    deployment_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    additional_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Analysis results (stored after AI investigation)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recommended_actions: Mapped[str | None] = mapped_column(JSON, nullable=True)
    recommended_runbook: Mapped[str | None] = mapped_column(String(200), nullable=True)
    similar_incidents: Mapped[str | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    hindsight_recalled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Resolution
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recovery_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Hindsight tracking
    hindsight_memory_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    retained_in_hindsight: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    timeline: Mapped[list["IncidentTimeline"]] = relationship("IncidentTimeline", back_populates="incident", cascade="all, delete-orphan", lazy="selectin")
    postmortem: Mapped["PostMortem | None"] = relationship("PostMortem", back_populates="incident", uselist=False, lazy="selectin")


class IncidentTimeline(Base):
    __tablename__ = "incident_timelines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    event: Mapped[str] = mapped_column(String(200))
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(String(50), default="info")

    incident: Mapped["Incident"] = relationship("Incident", back_populates="timeline")


class PostMortem(Base):
    __tablename__ = "postmortems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), unique=True)
    incident_summary: Mapped[str] = mapped_column(Text)
    root_cause: Mapped[str] = mapped_column(Text)
    what_happened: Mapped[str] = mapped_column(Text)
    resolution: Mapped[str] = mapped_column(Text)
    failed_attempts: Mapped[str | None] = mapped_column(Text, nullable=True)
    runbook_used: Mapped[str | None] = mapped_column(String(200), nullable=True)
    recovery_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lessons_learned: Mapped[str] = mapped_column(Text)
    preventive_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    saved_to_hindsight: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    incident: Mapped["Incident"] = relationship("Incident", back_populates="postmortem")


class Runbook(Base):
    __tablename__ = "runbooks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    service: Mapped[str] = mapped_column(String(100))
    purpose: Mapped[str] = mapped_column(Text)
    steps: Mapped[str] = mapped_column(JSON)
    warnings: Mapped[str | None] = mapped_column(JSON, nullable=True)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    total_uses: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def success_rate(self) -> float:
        if self.total_uses == 0:
            return 0.0
        return round(self.success_count / self.total_uses * 100, 1)


# Database setup
_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.app_env == "development",
        )
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_db() -> AsyncSession:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all database tables."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
