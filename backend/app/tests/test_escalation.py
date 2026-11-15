from __future__ import annotations

import pytest
from app.services.escalation_engine import (
    TIER_0,
    TIER_1,
    TIER_2,
    TIER_3,
    classify_tier,
    generate_alert_message,
    generate_emergency_report,
)
from app.services.health_engine import analyze, load_mission_telemetry, prepare


def test_escalation_classification():
    dummy_nominal = {"overall": {"tier": 0, "status": 0, "worstDomain": "car"}}
    dummy_attention = {"overall": {"tier": 1, "status": 1, "worstDomain": "imm"}}
    dummy_critical = {"overall": {"tier": 3, "status": 2, "worstDomain": "rad"}}

    assert classify_tier(dummy_nominal) == TIER_0
    assert classify_tier(dummy_attention) == TIER_1
    assert classify_tier(dummy_critical) == TIER_3


def test_emergency_report_generation():
    series = load_mission_telemetry("ASTRO-1")
    ctx = prepare(series)
    res = analyze(ctx, 45)
    alert = generate_alert_message(res, "ASTRO-1")

    rep = generate_emergency_report("ASTRO-1", res, alert)
    assert rep["astronaut_id"] == "ASTRO-1"
    assert "content_json" in rep
    assert "human_readable" in rep
    assert "ASTRA EMERGENCY MEDICAL ESCALATION REPORT" in rep["human_readable"]
    assert "disclaimer" in rep["content_json"]
