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
