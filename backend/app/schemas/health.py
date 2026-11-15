from __future__ import annotations

from typing import Optional, Any
from pydantic import BaseModel, Field


class IndicatorStatus(BaseModel):
    key: str
    name: str
    value: Optional[float] = None
    baseline: float
    drift: float
    level: int  # 0: Normal, 1: Watch, 2: Act


class DomainAnalysis(BaseModel):
    status: int  # -1: Learning, 0: Normal, 1: Watch, 2: Act
    score: float
    confidence: float
    rule: Optional[str] = None
    indicators: list[IndicatorStatus] = []


class ContributingPattern(BaseModel):
    domain: str
    text: str


class ForecastResult(BaseModel):
    key: str
    name: str
    days: int


class OverallHealthStatus(BaseModel):
    status: int
    tier: int  # 0: Nominal, 1: Attention, 2: High Priority, 3: Critical
    worstDomain: str


class SolarParticleEvent(BaseModel):
    day: int
    dose: float


class HealthAnalysisResponse(BaseModel):
    day: int
    adapting: bool
    domains: dict[str, DomainAnalysis]
    contributors: list[ContributingPattern] = []
    forecast: Optional[ForecastResult] = None
    overall: OverallHealthStatus
    spe: Optional[SolarParticleEvent] = None
    cumDose: float
    prototype_warning: bool = True
    ground_summary: Optional[str] = None


class RadiationAnalysisResponse(BaseModel):
    astronaut_id: str
    mission_day: int
    current_dose: float
    cumulative_dose: float
    mission_limit_msv: float
    fraction_of_limit: float
    spe_detected: bool
    spe_day: Optional[int] = None
    status: str  # nominal, watch, act
    trend: str
    csa_context: str
    prototype_disclaimer: str


class AssessmentRequest(BaseModel):
    astronaut_id: str = Field(..., description="Unique astronaut ID (e.g. ASTRO-1)")
    mission_day: int = Field(..., ge=1, le=1000, description="Mission day (1-indexed)")
    vitals: dict[str, Optional[float]] = Field(default_factory=dict, description="17 vitals and telemetry parameters")
    symptoms: list[str] = Field(default_factory=list, description="Reported clinical symptoms")
    notes: Optional[str] = Field("", description="Operational crew notes")
    api_key: Optional[str] = Field(None, description="FastAPI authentication key")


class PredictedCommand(BaseModel):
    priority: str  # "CRITICAL", "URGENT", "WATCH", "ROUTINE"
    domain: str  # "car", "imm", "neu", "msk", "env", "rad"
    title: str
    command: str
    rationale: str
    evidence_source: Optional[str] = None
    hazard: Optional[str] = None


class AssessmentResponse(BaseModel):
    astronaut_id: str
    mission_day: int
    tier: int
    tier_label: str
    status: str
    worst_domain: str
    worst_domain_name: str
    hazard: str
    domains: dict[str, Any]
    deviations: list[dict[str, Any]]
    predicted_commands: list[PredictedCommand]
    evidence_citations: list[dict[str, Any]]
    trajectories_7d: dict[str, Any]
    ground_summary: str
    timestamp: str
    prototype_disclaimer: str
