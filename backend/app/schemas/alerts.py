from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field


class AlertBase(BaseModel):
    astronaut_id: str
    mission_day: int
    tier: int = Field(..., ge=0, le=3, description="Escalation tier: 0=Nominal, 1=Attention, 2=High, 3=Critical")
    domain: str
    message: str
    metric_data: Optional[str] = None


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    id: int
    created_at: datetime
    acknowledged_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EmergencyReportCreate(BaseModel):
    astronaut_id: str
    mission_day: int
    alert_id: Optional[int] = None
    reason: Optional[str] = "Critical telemetry threshold exceeded"


class EmergencyReportResponse(BaseModel):
    id: int
    astronaut_id: str
    mission_day: int
    tier: int
    content_json: str
    human_readable: str
    communication_status: str  # queued, transmitted, failed, acknowledged
    queued_at: datetime
    transmitted_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    prototype_warning: str

    model_config = ConfigDict(from_attributes=True)


class ContactGroundRequest(BaseModel):
    report_id: int
    astronaut_id: str
    note: Optional[str] = None
