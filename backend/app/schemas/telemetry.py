from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class TelemetryBase(BaseModel):
    astronaut_id: str = Field(..., description="Unique astronaut ID (e.g. ASTRO-1)")
    mission_day: int = Field(..., ge=1, le=1000, description="Mission day (1-indexed)")
    timestamp: Optional[datetime] = None
    source: str = Field("simulated", description="Data source: simulated or entered")

    # 17 clinical and environmental metrics
    hr: Optional[float] = Field(None, description="Resting heart rate (bpm)")
    hrv: Optional[float] = Field(None, description="Heart rate variability (ms)")
    spo2: Optional[float] = Field(None, description="Blood oxygen saturation (%)")
    sbp: Optional[float] = Field(None, description="Systolic blood pressure (mmHg)")
    dbp: Optional[float] = Field(None, description="Diastolic blood pressure (mmHg)")
    temp: Optional[float] = Field(None, description="Resting core body temperature (°C)")
    slp: Optional[float] = Field(None, description="Sleep duration (hours)")
    fat: Optional[float] = Field(None, description="Fatigue score (/10)")
    ex: Optional[float] = Field(None, description="Exercise duration (minutes)")
    grip: Optional[float] = Field(None, description="Grip strength (kg)")
    nutrition: Optional[float] = Field(None, description="Nutrition intake score (/10)")
    hydration: Optional[float] = Field(None, description="Hydration glasses (glasses/day)")
    mood: Optional[float] = Field(None, description="Mood score (/10)")
    stress: Optional[float] = Field(None, description="Stress level (/10)")
    headache: Optional[float] = Field(None, description="Headache severity (/10)")
    co2: Optional[float] = Field(None, description="Cabin CO2 level (mmHg)")
    dose: Optional[float] = Field(None, description="Radiation dose rate (mSv/day)")


class TelemetryCreate(TelemetryBase):
    pass


class TelemetryResponse(TelemetryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class TelemetryBatchSync(BaseModel):
    records: list[TelemetryCreate]


class SyncQueueItem(BaseModel):
    action: str
    endpoint: str
    payload: dict
    timestamp: datetime
