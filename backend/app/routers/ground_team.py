from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alerts import CommunicationHistory, EmergencyReport
from app.models.ground_contact import GroundContact
from app.schemas.alerts import ContactGroundRequest, EmergencyReportCreate
from app.services.escalation_engine import generate_alert_message, generate_emergency_report
from app.services.ground_communication import acknowledge_report, queue_emergency_report, transmit_report
from app.services.health_engine import analyze, load_mission_telemetry, prepare

router = APIRouter(prefix="/ground-team", tags=["ground-team"])


@router.get("/contacts")
async def list_ground_contacts(db: AsyncSession = Depends(get_db)):
    stmt = select(GroundContact).order_by(GroundContact.id)
    res = await db.execute(stmt)
    records = res.scalars().all()
    return [
        {
            "id": r.id,
            "role": r.role,
            "name": r.name,
            "contact_info": r.contact_info,
            "is_configured": r.is_configured,
        }
        for r in records
    ]


@router.post("/emergency-report")
async def create_emergency_report_endpoint(
    req: EmergencyReportCreate,
    db: AsyncSession = Depends(get_db),
):
    series = load_mission_telemetry(req.astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {req.astronaut_id} not found")

    ctx = prepare(series)
    analysis_res = analyze(ctx, req.mission_day)
    alert_msg = generate_alert_message(analysis_res, req.astronaut_id)

    rep_data = generate_emergency_report(
        astronaut_id=req.astronaut_id,
        analysis_result=analysis_res,
        alert_message=alert_msg,
        alert_id=req.alert_id,
    )

    report = await queue_emergency_report(
        db=db,
        astronaut_id=rep_data["astronaut_id"],
        mission_day=rep_data["mission_day"],
        tier=rep_data["tier"],
        content_json=rep_data["content_json"],
        human_readable=rep_data["human_readable"],
        alert_id=rep_data["alert_id"],
    )

    return {
        "success": True,
        "report_id": report.id,
        "astronaut_id": report.astronaut_id,
        "mission_day": report.mission_day,
        "tier": report.tier,
        "communication_status": report.communication_status,
        "queued_at": report.queued_at.isoformat(),
        "human_readable": report.human_readable,
        "prototype_warning": "Report saved to local queue. Ready for crew-authorized downlink transmission.",
    }


@router.post("/contact")
async def trigger_contact_ground(
    req: ContactGroundRequest,
    db: AsyncSession = Depends(get_db),
):
    res = await transmit_report(db, req.report_id, note=req.note)
    return res


@router.get("/communication-status/{report_id}")
async def get_comm_status(report_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(EmergencyReport).where(EmergencyReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Emergency report not found")

    hist_stmt = select(CommunicationHistory).where(
        CommunicationHistory.emergency_report_id == report_id
    ).order_by(CommunicationHistory.id.desc())
    hist_res = await db.execute(hist_stmt)
    history = hist_res.scalars().all()

    return {
        "report_id": report.id,
        "astronaut_id": report.astronaut_id,
        "tier": report.tier,
        "communication_status": report.communication_status,
        "queued_at": report.queued_at.isoformat() if report.queued_at else None,
        "transmitted_at": report.transmitted_at.isoformat() if report.transmitted_at else None,
        "acknowledged_at": report.acknowledged_at.isoformat() if report.acknowledged_at else None,
        "attempts": [
            {
                "id": h.id,
                "attempt_at": h.attempt_at.isoformat(),
                "status": h.status,
                "response": h.response,
            }
            for h in history
        ],
    }


@router.get("/history")
async def list_emergency_reports(db: AsyncSession = Depends(get_db)):
    stmt = select(EmergencyReport).order_by(EmergencyReport.id.desc())
    res = await db.execute(stmt)
    reports = res.scalars().all()
    return [
        {
            "id": r.id,
            "astronaut_id": r.astronaut_id,
            "mission_day": r.mission_day,
            "tier": r.tier,
            "communication_status": r.communication_status,
            "queued_at": r.queued_at.isoformat() if r.queued_at else None,
            "transmitted_at": r.transmitted_at.isoformat() if r.transmitted_at else None,
            "acknowledged_at": r.acknowledged_at.isoformat() if r.acknowledged_at else None,
        }
        for r in reports
    ]


@router.post("/acknowledge/{report_id}")
async def acknowledge_report_endpoint(
    report_id: int,
    db: AsyncSession = Depends(get_db),
):
    res = await acknowledge_report(db, report_id)
    return res
