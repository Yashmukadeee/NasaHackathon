from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.alerts import Alert, AuditLog, CommunicationHistory, EmergencyReport


async def queue_emergency_report(
    db: AsyncSession,
    astronaut_id: str,
    mission_day: int,
    tier: int,
    content_json: dict,
    human_readable: str,
    alert_id: Optional[int] = None,
) -> EmergencyReport:
    report = EmergencyReport(
        alert_id=alert_id,
        astronaut_id=astronaut_id,
        mission_day=mission_day,
        tier=tier,
        content_json=json.dumps(content_json),
        human_readable=human_readable,
        communication_status="queued",
        queued_at=datetime.now(timezone.utc),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Log to audit log
    audit = AuditLog(
        event_type="EMERGENCY_REPORT_QUEUED",
        astronaut_id=astronaut_id,
        alert_id=alert_id,
        details=f"Emergency report #{report.id} created and queued locally (Tier {tier})",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)
    await db.commit()

    return report


async def transmit_report(db: AsyncSession, report_id: int, note: Optional[str] = None) -> dict:
    """
    Transmit report when astronaut explicitly requests it.
    If offline or no gateway: remains queued locally with clear status.
    """
    stmt = select(EmergencyReport).where(EmergencyReport.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    if not report:
        return {"success": False, "error": f"Report #{report_id} not found"}

    now = datetime.now(timezone.utc)

    # Check if external gateway is configured
    gateway_url = settings.EMAIL_GATEWAY_URL
    if gateway_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    gateway_url,
                    json={
                        "report_id": report.id,
                        "astronaut_id": report.astronaut_id,
                        "mission_day": report.mission_day,
                        "tier": report.tier,
                        "payload": json.loads(report.content_json),
                        "note": note,
                    },
                    headers={"Authorization": f"Bearer {settings.EMAIL_GATEWAY_API_KEY}"} if settings.EMAIL_GATEWAY_API_KEY else {},
                )
                if resp.status_code in (200, 201, 202):
                    report.communication_status = "transmitted"
                    report.transmitted_at = now
                    comm_hist = CommunicationHistory(
                        emergency_report_id=report.id,
                        attempt_at=now,
                        status="transmitted",
                        response=f"HTTP {resp.status_code}: Transmitted to ground gateway",
                    )
                    db.add(comm_hist)
                    await db.commit()
                    return {
                        "success": True,
                        "status": "transmitted",
                        "message": "Report successfully dispatched to Ground Flight Surgeon network.",
                        "report_id": report.id,
                    }
        except Exception as ex:
            report.communication_status = "queued_offline"
            comm_hist = CommunicationHistory(
                emergency_report_id=report.id,
                attempt_at=now,
                status="failed",
                response=f"Gateway communication failure: {str(ex)}",
            )
            db.add(comm_hist)
            await db.commit()
            return {
                "success": False,
                "status": "queued_offline",
                "message": "Gateway unreachable. Report safely preserved in onboard queue.",
                "report_id": report.id,
            }

    # No gateway configured: simulate verified offline queueing
    report.communication_status = "queued"
    comm_hist = CommunicationHistory(
        emergency_report_id=report.id,
        attempt_at=now,
        status="queued",
        response="No external relay gateway configured. Report queued in local persistent storage.",
    )
    db.add(comm_hist)
    await db.commit()

    return {
        "success": True,
        "status": "queued",
        "message": "Emergency contact initiated. Report preserved in local flight memory. Pending ground uplink window.",
        "report_id": report.id,
    }


async def acknowledge_report(db: AsyncSession, report_id: int, ack_text: str = "Acknowledged by Mission Control Flight Surgeon") -> dict:
    stmt = select(EmergencyReport).where(EmergencyReport.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    if not report:
        return {"success": False, "error": f"Report #{report_id} not found"}

    now = datetime.now(timezone.utc)
    report.communication_status = "acknowledged"
    report.acknowledged_at = now

    comm_hist = CommunicationHistory(
        emergency_report_id=report.id,
        attempt_at=now,
        status="acknowledged",
        response=ack_text,
    )
    db.add(comm_hist)

    audit = AuditLog(
        event_type="EMERGENCY_REPORT_ACKNOWLEDGED",
        astronaut_id=report.astronaut_id,
        details=f"Report #{report.id} acknowledged: {ack_text}",
        timestamp=now,
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "status": "acknowledged",
        "acknowledged_at": now.isoformat(),
        "ack_text": ack_text,
    }
