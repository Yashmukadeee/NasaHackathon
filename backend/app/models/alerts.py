from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    astronaut_id: Mapped[str] = mapped_column(
        String, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mission_day: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[int] = mapped_column(Integer, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    metric_data: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON stored as text
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    emergency_reports: Mapped[list[EmergencyReport]] = relationship(
        "EmergencyReport", back_populates="alert"
    )


class EmergencyReport(Base):
    __tablename__ = "emergency_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    astronaut_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    mission_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    tier: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    content_json: Mapped[str] = mapped_column(Text, nullable=False)
    human_readable: Mapped[str] = mapped_column(Text, nullable=False)
    communication_status: Mapped[str] = mapped_column(
        String, nullable=False, default="queued"
    )
    queued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    transmitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    alert: Mapped[Alert | None] = relationship("Alert", back_populates="emergency_reports")
    communication_history: Mapped[list[CommunicationHistory]] = relationship(
        "CommunicationHistory", back_populates="emergency_report"
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    astronaut_id: Mapped[str | None] = mapped_column(String, nullable=True)
    alert_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


# CommunicationHistory is defined here because it references EmergencyReport
class CommunicationHistory(Base):
    __tablename__ = "communication_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    emergency_report_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("emergency_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)

    emergency_report: Mapped[EmergencyReport] = relationship(
        "EmergencyReport", back_populates="communication_history"
    )
