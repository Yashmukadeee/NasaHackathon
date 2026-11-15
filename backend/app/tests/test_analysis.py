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
