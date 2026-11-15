from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.telemetry import Telemetry
from app.schemas.telemetry import TelemetryBatchSync, TelemetryCreate
from app.services.health_engine import load_mission_telemetry

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/{astronaut_id}")
async def get_telemetry_for_astronaut(
    astronaut_id: str,
    day: Optional[int] = Query(None, description="Specific mission day"),
    from_day: Optional[int] = Query(None, alias="from", description="Start day"),
    to_day: Optional[int] = Query(None, alias="to", description="End day"),
    db: AsyncSession = Depends(get_db),
):
    # First check database for custom entered/synced telemetry
    query = select(Telemetry).where(Telemetry.astronaut_id == astronaut_id)
    if day is not None:
        query = query.where(Telemetry.mission_day == day)
    if from_day is not None:
        query = query.where(Telemetry.mission_day >= from_day)
    if to_day is not None:
        query = query.where(Telemetry.mission_day <= to_day)
    query = query.order_by(Telemetry.mission_day)

    result = await db.execute(query)
    records = result.scalars().all()

    if records:
        return [
            {
                "id": r.id,
                "astronaut_id": r.astronaut_id,
                "mission_day": r.mission_day,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "source": r.source,
                "hr": r.hr, "hrv": r.hrv, "spo2": r.spo2, "sbp": r.sbp, "dbp": r.dbp,
                "temp": r.temp, "slp": r.slp, "fat": r.fat, "ex": r.ex, "grip": r.grip,
                "nutrition": r.nutrition, "hydration": r.hydration, "mood": r.mood,
                "stress": r.stress, "headache": r.headache, "co2": r.co2, "dose": r.dose,
            }
            for r in records
        ]

    # Fallback: serve from benchmark mission.json
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"No telemetry found for {astronaut_id}")

    days_list = []
    start = from_day if from_day else (day if day else 1)
    end = to_day if to_day else (day if day else 180)

    for d in range(start, end + 1):
        idx = d - 1
        item = {
            "astronaut_id": astronaut_id,
            "mission_day": d,
            "source": "simulated_benchmark",
        }
        for k, vals in series.items():
            item[k] = vals[idx] if idx < len(vals) else None
        days_list.append(item)

    return days_list


@router.post("")
async def create_telemetry(entry: TelemetryCreate, db: AsyncSession = Depends(get_db)):
    # Check if entry already exists
    stmt = select(Telemetry).where(
        Telemetry.astronaut_id == entry.astronaut_id,
        Telemetry.mission_day == entry.mission_day,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        for k, v in entry.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        await db.commit()
        await db.refresh(existing)
        return {"success": True, "message": "Updated telemetry", "id": existing.id}

    tele = Telemetry(**entry.model_dump())
    if not tele.timestamp:
        tele.timestamp = datetime.now(timezone.utc)
    db.add(tele)
    await db.commit()
    await db.refresh(tele)
    return {"success": True, "message": "Created telemetry", "id": tele.id}


@router.post("/batch")
async def batch_sync_telemetry(batch: TelemetryBatchSync, db: AsyncSession = Depends(get_db)):
    created = 0
    updated = 0
    for entry in batch.records:
        stmt = select(Telemetry).where(
            Telemetry.astronaut_id == entry.astronaut_id,
            Telemetry.mission_day == entry.mission_day,
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            for k, v in entry.model_dump(exclude_unset=True).items():
                setattr(existing, k, v)
            updated += 1
        else:
            tele = Telemetry(**entry.model_dump())
            if not tele.timestamp:
                tele.timestamp = datetime.now(timezone.utc)
            db.add(tele)
            created += 1

    await db.commit()
    return {"success": True, "synced_total": len(batch.records), "created": created, "updated": updated}
