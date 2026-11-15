from __future__ import annotations

from typing import Optional
from app.services.nasa_research import DOMAIN_FINDINGS, RESEARCH_SOURCES, get_findings_for_domain, get_research_summary_for_alert

METRIC_TO_DOMAIN = {
    "hr": "car", "hrv": "car", "spo2": "car", "sbp": "car", "dbp": "car",
    "temp": "imm", "fat": "imm", "hydration": "imm",
    "slp": "beh", "mood": "beh", "stress": "beh", "headache": "beh",
    "ex": "msk", "grip": "msk", "nutrition": "msk",
    "co2": "env",
    "dose": "rad",
}

DOMAIN_NAMES = {
    "imm": "Immune System",
    "msk": "Musculoskeletal",
    "car": "Cardiovascular",
    "beh": "Behavioral & Psychological",
    "env": "Environmental / Life Support",
    "rad": "Space Radiation",
}

DOMAIN_HAZARD_MAP = {
    "rad": "Space Radiation",
    "imm": "Hostile Closed Environment",
    "car": "Gravity Fields (Microgravity)",
    "msk": "Gravity Fields (Microgravity)",
    "beh": "Isolation and Confinement",
    "env": "Hostile Closed Environment",
}


def get_evidence_for_alert(domain: str, tier: int, contributing_metrics: Optional[list] = None) -> dict:
    findings = get_findings_for_domain(domain)
    hazard = DOMAIN_HAZARD_MAP.get(domain, "Spaceflight Environmental Factors")
    summary = get_research_summary_for_alert(domain, tier)
    return {
        "domain": domain,
        "domain_name": DOMAIN_NAMES.get(domain, domain.upper()),
        "hazard": hazard,
        "findings": findings,
        "summary": summary,
        "source_attribution": [f["source"] for f in findings] if findings else [],
    }


def map_metrics_to_domains(metrics: list[str]) -> dict[str, list[str]]:
    result = {}
    for m in metrics:
        d = METRIC_TO_DOMAIN.get(m)
        if d:
            result.setdefault(d, []).append(m)
    return result
