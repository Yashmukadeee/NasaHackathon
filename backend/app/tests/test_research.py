from __future__ import annotations

import pytest
from app.services.evidence_mapping import get_evidence_for_alert
from app.services.nasa_research import (
    RESEARCH_SOURCES,
    get_all_sources,
    get_findings_for_domain,
)


def test_research_sources_list():
    sources = get_all_sources()
    assert len(sources) == 5
    urls = [s["url"] for s in sources]
    assert "https://www.nasa.gov/hrp/hazards/" in urls
    assert "https://www.nasa.gov/hrp/risks/" in urls
    assert "https://www.nasa.gov/hrp/ongoing-hrp-research/" in urls
    assert any("asc-csa.gc.ca" in u for u in urls)


def test_evidence_mapping_for_domains():
    for dm in ["rad", "imm", "car", "msk", "beh", "env"]:
        ev = get_evidence_for_alert(dm, 2)
        assert ev["domain"] == dm
        assert len(ev["findings"]) > 0
        assert "hazard" in ev
        assert "summary" in ev
        assert ev["summary"]["agency"] in ("NASA", "CSA")


def test_csa_radiation_instruments_attribution():
    findings = get_findings_for_domain("rad")
    has_csa_instrument = False
    for f in findings:
        if "csa_instruments" in f:
            has_csa_instrument = True
            assert "EVARM" in " ".join(f["csa_instruments"])
    assert has_csa_instrument
