from app.routers.astronauts import router as astronauts_router
from app.routers.telemetry import router as telemetry_router
from app.routers.analysis import router as analysis_router
from app.routers.research import router as research_router
from app.routers.alerts import router as alerts_router
from app.routers.radiation import router as radiation_router
from app.routers.ground_team import router as ground_team_router
from app.routers.mission import router as mission_router

__all__ = [
    "astronauts_router",
    "telemetry_router",
    "analysis_router",
    "research_router",
    "alerts_router",
    "radiation_router",
    "ground_team_router",
    "mission_router",
]
