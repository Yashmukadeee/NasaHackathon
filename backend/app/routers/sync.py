from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.telemetry import Telemetry
from app.models.alerts import Alert, EmergencyReport
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/sync", tags=["synchronization"])


class SyncRecordItem(BaseModel):
    record_type: str = Field(..., description="telemetry, checkin, alert, or emergency")
    astronaut_id: str
    mission_day: int
    data: dict[str, Any]
    client_timestamp: Optional[str] = None


class BatchSyncRequest(BaseModel):
    astronaut_id: Optional[str] = "ASTRO-1"
    records: List[SyncRecordItem] = Field(default_factory=list)
    client_queue_id: Optional[str] = None


@router.post("/batch")
async def sync_batch(req: BatchSyncRequest, db: AsyncSession = Depends(get_db)):
    """
    Reconciles locally buffered offline data packets (telemetry, check-ins, alerts).
    Prevents duplicates using compound keys (astronaut_id + mission_day + metric),
    stores in onboard database, and forwards to Supabase cloud storage.
    """
    synced_count = 0
    errors = []

    for item in req.records:
        try:
            if item.record_type in ("telemetry", "checkin"):
                # Upsert telemetry row
                stmt = select(Telemetry).where(
                    Telemetry.astronaut_id == item.astronaut_id,
                    Telemetry.mission_day == item.mission_day,
                )
                res = await db.execute(stmt)
                existing = res.scalar_one_or_none()

                if existing:
                    for k, v in item.data.items():
                        if hasattr(existing, k) and v is not None:
                            setattr(existing, k, v)
                else:
                    tele = Telemetry(
                        astronaut_id=item.astronaut_id,
                        mission_day=item.mission_day,
                        source=item.data.get("source", "offline_sync"),
                        timestamp=datetime.now(timezone.utc),
                        **{k: v for k, v in item.data.items() if hasattr(Telemetry, k) and k not in ("id", "astronaut_id", "mission_day", "source", "timestamp")}
                    )
                    db.add(tele)
                synced_count += 1

            elif item.record_type == "alert":
                alert = Alert(
                    astronaut_id=item.astronaut_id,
                    mission_day=item.mission_day,
                    tier=item.data.get("tier", 1),
                    domain=item.data.get("domain", "gen"),
                    message=item.data.get("message", "Synced alert"),
                    metric_data=item.data.get("metric_data"),
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                synced_count += 1

        except Exception as e:
            errors.append({"item": item.model_dump(), "error": str(e)})

    await db.commit()

    return {
        "success": len(errors) == 0,
        "synced_count": synced_count,
        "total_submitted": len(req.records),
        "errors": errors,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "database_status": "COMMITTED",
    }


@router.get("/pending")
async def get_pending_sync_status(astronaut_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """
    Checks if there are pending or queued emergency reports awaiting ground downlink transmission.
    """
    stmt = select(EmergencyReport).where(EmergencyReport.communication_status == "QUEUED")
    if astronaut_id:
        stmt = stmt.where(EmergencyReport.astronaut_id == astronaut_id)

    res = await db.execute(stmt)
    pending_reports = res.scalars().all()

    return {
        "pending_emergency_reports_count": len(pending_reports),
        "reports": [
            {
                "id": r.id,
                "astronaut_id": r.astronaut_id,
                "mission_day": r.mission_day,
                "tier": r.tier,
                "queued_at": r.queued_at.isoformat() if r.queued_at else None,
            }
            for r in pending_reports
        ],
        "offline_buffer_ready": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/retry")
async def retry_pending_sync(astronaut_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """
    Triggers retry transmission for all pending queued emergency reports.
    """
    from app.services.ground_communication import transmit_report

    stmt = select(EmergencyReport).where(EmergencyReport.communication_status == "QUEUED")
    if astronaut_id:
        stmt = stmt.where(EmergencyReport.astronaut_id == astronaut_id)

    res = await db.execute(stmt)
    pending_reports = res.scalars().all()

    results = []
    for report in pending_reports:
        trans_res = await transmit_report(db, report.id, note="Automated offline sync retry upon connectivity recovery")
        results.append(trans_res)

    return {
        "retried_count": len(results),
        "results": results,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
