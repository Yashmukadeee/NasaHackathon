from __future__ import annotations

import os
import json
from fastapi import APIRouter

router = APIRouter(prefix="/mission", tags=["mission"])


@router.get("/overview")
async def get_mission_overview():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    json_path = os.path.join(base_dir, "web", "data", "mission.json")
    if not os.path.exists(json_path):
        json_path = os.path.join("c:\\NasaHackathon-master", "web", "data", "mission.json")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return {
        "mission_name": "ASTRA-180 Long-Duration Deep Space Simulation",
        "duration_days": data.get("days", 180),
        "crew_count": len(data.get("astronauts", [])),
        "crew": [
            {
                "id": a.get("id"),
                "name": a.get("name"),
                "role": a.get("role"),
                "age": a.get("age"),
                "blood_type": a.get("blood_type"),
            }
            for a in data.get("astronauts", [])
        ],
        "status": "OPERATIONAL",
    }
