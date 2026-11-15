from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.astronaut import Astronaut
from app.services.health_engine import load_mission_document

router = APIRouter(prefix="/mission", tags=["mission"])


@router.get("/overview")
async def get_mission_overview(db: AsyncSession = Depends(get_db)):
    data = load_mission_document()

    # The roster lives in the relational database (seeded at startup); the
    # mission.json `astronauts` array is only a fallback for datasets that ship one.
    stmt = select(Astronaut).order_by(Astronaut.id)
    res = await db.execute(stmt)
    roster = res.scalars().all()

    crew = [
        {
            "id": a.id,
            "name": a.name,
            "role": a.role,
            "age": a.age,
            "blood_type": a.blood_type,
        }
        for a in roster
    ]
    if not crew:
        crew = [
            {
                "id": a.get("id"),
                "name": a.get("name"),
                "role": a.get("role"),
                "age": a.get("age"),
                "blood_type": a.get("blood_type"),
            }
            for a in (data.get("astronauts") or [])
        ]

    return {
        "mission_name": "ASTRA-180 Long-Duration Deep Space Simulation",
        "duration_days": data.get("days") or data.get("meta", {}).get("days", 180),
        "crew_count": len(crew),
        "crew": crew,
        "status": "OPERATIONAL",
    }
