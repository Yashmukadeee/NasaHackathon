from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.astronaut import Astronaut

router = APIRouter(prefix="/astronauts", tags=["astronauts"])


@router.get("")
async def list_astronauts(db: AsyncSession = Depends(get_db)):
    stmt = select(Astronaut).order_by(Astronaut.id)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "role": a.role,
            "age": a.age,
            "blood_type": a.blood_type,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in records
    ]


@router.get("/{astronaut_id}")
async def get_astronaut(astronaut_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Astronaut).where(Astronaut.id == astronaut_id)
    result = await db.execute(stmt)
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")
    return {
        "id": a.id,
        "name": a.name,
        "role": a.role,
        "age": a.age,
        "blood_type": a.blood_type,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
