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
from app.services.ground_communication import queue_emergency_report
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/sync", tags=["synchronization"])


def _normalise_sync_record(raw: Any) -> Optional[dict]:
    """
    Accept both sync payload shapes used by the clients:

    * offline-queue shape  -> {id, type, astronaut_id, day, payload, status, timestamp}
    * API shape            -> {record_type, astronaut_id, mission_day, data, client_timestamp}

    Returns None when the record cannot be interpreted at all.
    """
    if not isinstance(raw, dict):
        return None

    record_type = str(raw.get("record_type") or raw.get("type") or "telemetry").lower()
    astronaut_id = raw.get("astronaut_id") or "ASTRO-1"
    mission_day = raw.get("mission_day", raw.get("day"))
    data = raw.get("data") or raw.get("payload") or {}
    if not isinstance(data, dict):
        data = {}

    try:
        mission_day = int(mission_day)
    except (TypeError, ValueError):
        return None

    return {
        "record_type": record_type,
        "astronaut_id": astronaut_id,
        "mission_day": mission_day,
        "data": data,
        "client_timestamp": raw.get("client_timestamp") or raw.get("timestamp"),
        "client_id": raw.get("id"),
    }


class BatchSyncRequest(BaseModel):
    astronaut_id: Optional[str] = "ASTRO-1"
    records: List[dict[str, Any]] = Field(default_factory=list)
    client_queue_id: Optional[str] = None


@router.post("/batch")
async def sync_batch(req: BatchSyncRequest, db: AsyncSession = Depends(get_db)):
    """
    Reconciles locally buffered offline data packets (telemetry, check-ins, alerts,
    emergency reports). Prevents duplicates using compound keys
    (astronaut_id + mission_day), stores in the onboard database, and forwards to
    Supabase cloud storage.
    """
    synced_count = 0
    errors = []
    acknowledged_ids: List[str] = []

    for raw in req.records:
        item = _normalise_sync_record(raw)
        if item is None:
            errors.append({"item": raw, "error": "Unrecognised sync record shape"})
            continue
        if item["client_id"]:
            acknowledged_ids.append(str(item["client_id"]))

        try:
            record_type = item["record_type"]
            data = item["data"]
            astronaut_id = item["astronaut_id"]
            mission_day = item["mission_day"]

            if record_type in ("telemetry", "checkin"):
                # Upsert telemetry row
                stmt = select(Telemetry).where(
                    Telemetry.astronaut_id == astronaut_id,
                    Telemetry.mission_day == mission_day,
                )
                res = await db.execute(stmt)
                existing = res.scalar_one_or_none()

                if existing:
                    for k, v in data.items():
                        if hasattr(existing, k) and v is not None:
                            setattr(existing, k, v)
                else:
                    tele = Telemetry(
                        astronaut_id=astronaut_id,
                        mission_day=mission_day,
                        source=data.get("source", "offline_sync"),
                        timestamp=datetime.now(timezone.utc),
                        **{k: v for k, v in data.items() if hasattr(Telemetry, k) and k not in ("id", "astronaut_id", "mission_day", "source", "timestamp")}
                    )
                    db.add(tele)
                synced_count += 1

                # Best-effort cloud forward; failure never blocks local storage.
                try:
                    reading = {
                        "astronaut_id": astronaut_id,
                        "device_id": "OFFLINE_QUEUE",
                        "metric_name": "checkin",
                        "metric_value": 0,
                        "unit": "",
                        "source": data.get("source", "offline_sync"),
                        "measurement_provenance": {"synced": True, "mission_day": mission_day},
                    }
                    await supabase_service.insert_telemetry_reading(reading)
                except Exception:
                    pass

            elif record_type == "alert":
                alert = Alert(
                    astronaut_id=astronaut_id,
                    mission_day=mission_day,
                    tier=data.get("tier", 1),
                    domain=data.get("domain", "gen"),
                    message=data.get("message", "Synced alert"),
                    metric_data=data.get("metric_data"),
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                synced_count += 1

            elif record_type in ("emergency", "emergency_report"):
                tier = int(data.get("tier", 3))
                content = {
                    "astronaut_id": astronaut_id,
                    "mission_day": mission_day,
                    "tier": tier,
                    "source": "offline_sync",
                    "reason": data.get("reason", "Offline buffered emergency report"),
                }
                report = await queue_emergency_report(
                    db=db,
                    astronaut_id=astronaut_id,
                    mission_day=mission_day,
                    tier=tier,
                    content_json=content,
                    human_readable=(
                        f"OFFLINE-BUFFERED EMERGENCY REPORT\n"
                        f"Astronaut: {astronaut_id} | Mission Day: {mission_day}\n"
                        f"Tier: {tier}\n"
                        f"Reason: {content['reason']}"
                    ),
                )
                acknowledged_ids.append(f"report:{report.id}")
                synced_count += 1

            else:
                errors.append({"item": raw, "error": f"Unknown record_type '{record_type}'"})

        except Exception as e:
            errors.append({"item": raw, "error": str(e)})

    await db.commit()

    return {
        "success": len(errors) == 0,
        "synced_count": synced_count,
        "synchronized_count": synced_count,
        "total_submitted": len(req.records),
        "acknowledged_ids": acknowledged_ids,
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
