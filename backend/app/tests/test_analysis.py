from __future__ import annotations

import pytest
from app.services.health_engine import (
    analyze,
    ground_summary,
    load_mission_telemetry,
    prepare,
)


def test_prepare_and_analyze_day_10():
    series = load_mission_telemetry("ASTRO-1")
    assert series is not None
    assert "hr" in series
    ctx = prepare(series)
    assert ctx is not None
    assert "hr" in ctx.base

    res = analyze(ctx, 10)
    assert res["day"] == 10
    assert "domains" in res
    assert "imm" in res["domains"]
    assert "overall" in res
    assert res["overall"]["tier"] in (0, 1, 2, 3)


def test_ground_summary_generation():
    series = load_mission_telemetry("ASTRO-1")
    ctx = prepare(series)
    summary = ground_summary(ctx, 45)
    assert "MISSION VITALS GROUND SUMMARY" in summary
    assert "Escalation tier:" in summary
    assert "Cumulative radiation:" in summary


def test_infection_pattern_synergy():
    # Construct a synthetic series where temp, fat, and hr spike after baseline
    series = {k: [None] * 180 for k in ["temp", "fat", "hr", "dose", "slp", "mood", "stress", "headache", "ex", "grip", "nutrition", "hydration", "co2", "hrv", "spo2", "sbp", "dbp"]}
    # Baseline normal values
    for d in range(1, 31):
        series["temp"][d - 1] = 36.6
        series["fat"][d - 1] = 2.0
        series["hr"][d - 1] = 65.0
        series["dose"][d - 1] = 0.4

    # High temp + fatigue on days 40-45
    for d in range(35, 50):
        series["temp"][d - 1] = 38.5  # High fever
        series["fat"][d - 1] = 8.5    # High fatigue
        series["hr"][d - 1] = 95.0
        series["dose"][d - 1] = 0.4

    ctx = prepare(series)
    res = analyze(ctx, 45)
    # Infection rule should trigger Act (2) on imm, overall tier should escalate
    assert res["domains"]["imm"]["status"] == 2
    assert res["domains"]["imm"]["rule"] == "infection"
    assert res["overall"]["tier"] >= 2


def test_fastapi_assess_endpoint_authentication_and_prediction():
    from starlette.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. Reject without key
    unauth_resp = client.post("/api/v1/analysis/assess", json={
        "astronaut_id": "ASTRO-1",
        "mission_day": 45,
        "vitals": {"hr": 70, "temp": 36.6}
    })
    assert unauth_resp.status_code == 401

    # 2. Accept with valid X-API-Key header and predict astronaut commands
    auth_resp = client.post(
        "/api/v1/analysis/assess",
        headers={"X-API-Key": "astra_flight_ops_2026"},
        json={
            "astronaut_id": "ASTRO-1",
            "mission_day": 45,
            "vitals": {
                "fat": 8.5,
                "stress": 8.0,
                "slp": 4.2,
                "sbp": 138,
                "dbp": 92,
                "temp": 37.8,
                "headache": 6.0
            },
            "symptoms": ["Headache / ICP Elevation", "Cognitive Slowing / Brain Fog"],
            "notes": "Severe orbital headache, high fatigue post EVA"
        }
    )
    assert auth_resp.status_code == 200
    data = auth_resp.json()
    assert data["status"] in ("Normal", "Watch", "Act")
    assert "tier" in data
    assert len(data["predicted_commands"]) > 0
    assert "evidence_citations" in data
    assert len(data["evidence_citations"]) > 0

    first_cmd = data["predicted_commands"][0]
    assert "priority" in first_cmd
    assert "command" in first_cmd
    assert "rationale" in first_cmd
    assert "NASA HRP" in first_cmd["rationale"] or "Microgravity" in first_cmd["rationale"]

