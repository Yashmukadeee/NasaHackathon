from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    astronaut_id: Mapped[str] = mapped_column(
        String, ForeignKey("astronauts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mission_day: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="simulated")

    # Vital signs
    hr: Mapped[float | None] = mapped_column(Float, nullable=True)      # Heart rate (bpm)
    hrv: Mapped[float | None] = mapped_column(Float, nullable=True)     # HRV (ms)
    spo2: Mapped[float | None] = mapped_column(Float, nullable=True)    # SpO2 (%)
    sbp: Mapped[float | None] = mapped_column(Float, nullable=True)     # Systolic BP (mmHg)
    dbp: Mapped[float | None] = mapped_column(Float, nullable=True)     # Diastolic BP (mmHg)
    temp: Mapped[float | None] = mapped_column(Float, nullable=True)    # Body temp (°C)

    # Activity & physical
    slp: Mapped[float | None] = mapped_column(Float, nullable=True)     # Sleep duration (h)
    fat: Mapped[float | None] = mapped_column(Float, nullable=True)     # Fatigue score
    ex: Mapped[float | None] = mapped_column(Float, nullable=True)      # Exercise minutes
    grip: Mapped[float | None] = mapped_column(Float, nullable=True)    # Grip strength (kg)

    # Nutrition & environment
    nutrition: Mapped[float | None] = mapped_column(Float, nullable=True)  # Nutrition score
    hydration: Mapped[float | None] = mapped_column(Float, nullable=True)  # Hydration (L)
    mood: Mapped[float | None] = mapped_column(Float, nullable=True)       # Mood score
    stress: Mapped[float | None] = mapped_column(Float, nullable=True)     # Stress score
    headache: Mapped[float | None] = mapped_column(Float, nullable=True)   # Headache intensity
    co2: Mapped[float | None] = mapped_column(Float, nullable=True)        # CO2 level (ppm)
    dose: Mapped[float | None] = mapped_column(Float, nullable=True)       # Radiation dose (mSv)

    __table_args__ = (
        UniqueConstraint("astronaut_id", "mission_day", name="uq_telemetry_astronaut_day"),
    )
