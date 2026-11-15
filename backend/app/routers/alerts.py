from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alerts import Alert, AuditLog
from app.schemas.alerts import AlertCreate
from app.services.escalation_engine import (
    generate_alert_message,
    generate_emergency_report,
)
from app.services.health_engine import analyze, load_mission_telemetry, prepare

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    astronaut_id: Optional[str] = Query(None),
    tier: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Alert)
    if astronaut_id:
        query = query.where(Alert.astronaut_id == astronaut_id)
    if tier is not None:
        query = query.where(Alert.tier == tier)
    query = query.order_by(Alert.id.desc())

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        {
            "id": a.id,
            "astronaut_id": a.astronaut_id,
            "mission_day": a.mission_day,
            "tier": a.tier,
            "domain": a.domain,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        }
        for a in records
    ]


@router.get("/critical")
async def list_critical_alerts(db: AsyncSession = Depends(get_db)):
    query = select(Alert).where(Alert.tier >= 2).order_by(Alert.id.desc())
    result = await db.execute(query)
    records = result.scalars().all()
    return [
        {
            "id": a.id,
            "astronaut_id": a.astronaut_id,
            "mission_day": a.mission_day,
            "tier": a.tier,
            "domain": a.domain,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        }
        for a in records
    ]


@router.post("")
async def create_alert(alert_in: AlertCreate, db: AsyncSession = Depends(get_db)):
    alert = Alert(
        astronaut_id=alert_in.astronaut_id,
        mission_day=alert_in.mission_day,
        tier=alert_in.tier,
        domain=alert_in.domain,
        message=alert_in.message,
        metric_data=alert_in.metric_data,
        created_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    # Audit log
    audit = AuditLog(
        event_type="ALERT_CREATED",
        astronaut_id=alert.astronaut_id,
        alert_id=alert.id,
        details=f"Alert #{alert.id} generated (Tier {alert.tier}): {alert.message}",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "alert_id": alert.id, "tier": alert.tier}


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Alert).where(Alert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    now = datetime.now(timezone.utc)
    alert.acknowledged_at = now

    audit = AuditLog(
        event_type="ALERT_ACKNOWLEDGED",
        astronaut_id=alert.astronaut_id,
        alert_id=alert.id,
        details=f"Alert #{alert.id} acknowledged by crew member",
        timestamp=now,
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "alert_id": alert.id, "acknowledged_at": now.isoformat()}
