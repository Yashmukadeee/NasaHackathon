from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.evidence_mapping import get_evidence_for_alert
from app.services.nasa_research import (
    DOMAIN_FINDINGS,
    RESEARCH_SOURCES,
    get_all_sources,
    get_findings_for_domain,
)
from app.services.research_retrieval import refresh_all_sources

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/sources")
async def list_sources():
    return {
        "sources": get_all_sources(),
        "disclaimer": (
            "All citations are from public NASA Human Research Program and Canadian Space Agency "
            "educational and scientific literature. ASTRA is an independent academic/hackathon project."
        ),
    }


@router.get("/findings")
async def list_findings(domain: Optional[str] = Query(None)):
    if domain:
        findings = get_findings_for_domain(domain)
        return {"domain": domain, "findings": findings}
    return {"all_domains": DOMAIN_FINDINGS}


@router.get("/domain/{domain}")
async def get_domain_research(domain: str, tier: int = Query(1, ge=0, le=3)):
    evidence = get_evidence_for_alert(domain, tier)
    if not evidence.get("findings"):
        raise HTTPException(status_code=404, detail=f"Domain {domain} not recognized")
    return evidence


@router.post("/refresh")
async def refresh_research_sources():
    results = await refresh_all_sources()
    return {
        "success": True,
        "message": "Research knowledge base refresh cycle executed.",
        "results": results,
    }


@router.post("/analyze")
async def analyze_research_evidence(payload: dict):
    """
    Connects observed clinical anomalies to verified NASA HRP and CSA research evidence.
    Returns associated NASA hazards, risks, findings, and traceable references.
    """
    domain = payload.get("domain", "car")
    tier = int(payload.get("tier", 1))

    evidence = get_evidence_for_alert(domain, tier)
    domain_findings = get_findings_for_domain(domain)

    return {
        "domain": domain,
        "tier": tier,
        "evidence": evidence,
        "matching_findings_count": len(domain_findings),
        "verified_citations": [
            s for s in RESEARCH_SOURCES if s.get("status") == "verified"
        ],
        "disclaimer": "Traceable scientific evidence grounded in NASA HRP and CSA space medicine literature.",
    }
