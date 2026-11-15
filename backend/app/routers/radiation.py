from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from app.services.health_engine import load_mission_telemetry
from app.services.radiation_analysis import analyze_radiation

router = APIRouter(prefix="/radiation", tags=["radiation"])


@router.get("/{astronaut_id}")
async def get_radiation_telemetry(
    astronaut_id: str,
    day: int = Query(45, ge=1, le=180, description="Mission day"),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    dose_series = series.get("dose", [])
    analysis = analyze_radiation(dose_series, day)
    analysis["astronaut_id"] = astronaut_id

    # Add historical daily dose for trend charting
    history = []
    for d in range(1, day + 1):
        idx = d - 1
        history.append({
            "day": d,
            "dose": dose_series[idx] if idx < len(dose_series) and dose_series[idx] is not None else 0.4,
        })
    analysis["daily_history"] = history

    return analysis
