from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ResearchSourceSchema(BaseModel):
    id: Optional[int] = None
    agency: str = Field(..., description="NASA or CSA")
    title: str
    url: str
    retrieved_at: Optional[datetime] = None
    status: str = "verified"


class ResearchFindingSchema(BaseModel):
    id: Optional[int] = None
    health_domain: str
    hazard: Optional[str] = None
    risk: Optional[str] = None
    finding: str
    evidence_type: str = "established"
    source: ResearchSourceSchema
    csa_instruments: Optional[list[str]] = None


class DomainResearchResponse(BaseModel):
    domain: str
    domain_name: str
    hazard: str
    findings: list[ResearchFindingSchema]
    source_attribution: list[ResearchSourceSchema]
    prototype_disclaimer: str = (
        "ASTRA is a research and hackathon decision-support prototype. "
        "Findings are cited from official NASA HRP and CSA publications for educational and reference purposes only. "
        "NASA and CSA do not endorse this application or verify clinical accuracy."
    )
