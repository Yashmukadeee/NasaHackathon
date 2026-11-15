from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.health_engine import (
    analyze,
    ground_summary,
    load_mission_telemetry,
    prepare,
)
from app.services.risk_prediction import forecast_days_to_amber, predict_risk_trajectory

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/{astronaut_id}")
async def get_health_analysis(
    astronaut_id: str,
    day: int = Query(45, ge=1, le=180, description="Mission day to analyze"),
    include_summary: bool = Query(True, description="Include ground summary text"),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found in mission telemetry")

    ctx = prepare(series)
    res = analyze(ctx, day)

    if include_summary:
        res["ground_summary"] = ground_summary(ctx, day)
    res["astronaut_id"] = astronaut_id
    res["prototype_disclaimer"] = "Prototype decision-support analysis. Not certified clinical medical diagnostic."

    return res


@router.get("/{astronaut_id}/forecast")
async def get_health_forecast(
    astronaut_id: str,
    day: int = Query(45, ge=1, le=180),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    ctx = prepare(series)
    res = analyze(ctx, day)

    metric_trajectories = {}
    for k in ["temp", "hr", "fat", "ex", "grip", "co2", "slp"]:
        if k in series:
            traj = predict_risk_trajectory(
                series=series[k][:day],
                baseline_mean=ctx.base[k]["mean"],
                baseline_sd=ctx.base[k]["sd"],
                direction=ctx.cfg["metrics"][k]["dir"],
                horizon_days=7,
            )
            metric_trajectories[k] = traj

    return {
        "astronaut_id": astronaut_id,
        "day": day,
        "linear_forecast": res.get("forecast"),
        "7_day_metric_trajectories": metric_trajectories,
    }


@router.get("/{astronaut_id}/history")
async def get_analysis_history(
    astronaut_id: str,
    from_day: int = Query(1, ge=1, le=180),
    to_day: int = Query(45, ge=1, le=180),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    ctx = prepare(series)
    history = []
    for d in range(from_day, to_day + 1):
        res = analyze(ctx, d)
        history.append({
            "day": d,
            "tier": res["overall"]["tier"],
            "status": res["overall"]["status"],
            "worst_domain": res["overall"]["worstDomain"],
            "cum_dose": round(res["cumDose"], 1),
            "spe_active": res["spe"] is not None,
        })

    return {"astronaut_id": astronaut_id, "history": history}
