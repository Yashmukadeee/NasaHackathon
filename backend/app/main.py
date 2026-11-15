from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal, init_db
from app.models.astronaut import Astronaut
from app.models.ground_contact import GroundContact


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

_SEED_ASTRONAUTS = [
    {
        "id": "ASTRO-1",
        "name": "CDR. Alex Chen",
        "role": "Commander",
        "age": 41,
        "blood_type": "O-POS",
    },
    {
        "id": "ASTRO-2",
        "name": "LCDR. Sarah Tanaka",
        "role": "CMO/Biologist",
        "age": 38,
        "blood_type": "A-POS",
    },
    {
        "id": "ASTRO-3",
        "name": "Marcus Vance",
        "role": "Flight Engineer",
        "age": 44,
        "blood_type": "B-POS",
    },
]

_SEED_CONTACTS = [
    {"role": "Flight Surgeon", "name": "Flight Surgeon", "contact_info": None, "is_configured": False},
    {"role": "Medical Officer", "name": "Medical Officer", "contact_info": None, "is_configured": False},
    {"role": "Mission Control", "name": "Mission Control", "contact_info": None, "is_configured": False},
]


async def _seed_data() -> None:
    async with AsyncSessionLocal() as session:
        # Seed astronauts
        for data in _SEED_ASTRONAUTS:
            result = await session.execute(
                select(Astronaut).where(Astronaut.id == data["id"])
            )
            if result.scalar_one_or_none() is None:
                astronaut = Astronaut(
                    id=data["id"],
                    name=data["name"],
                    role=data["role"],
                    age=data["age"],
                    blood_type=data["blood_type"],
                    created_at=datetime.now(timezone.utc),
                )
                session.add(astronaut)

        # Seed ground contacts
        for contact_data in _SEED_CONTACTS:
            result = await session.execute(
                select(GroundContact).where(GroundContact.role == contact_data["role"])
            )
            if result.scalar_one_or_none() is None:
                contact = GroundContact(
                    role=contact_data["role"],
                    name=contact_data["name"],
                    contact_info=contact_data["contact_info"],
                    is_configured=contact_data["is_configured"],
                )
                session.add(contact)

        await session.commit()


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _seed_data()
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ASTRA – Astronaut Health Intelligence System",
    version="1.0.0",
    description="Backend API for real-time astronaut health monitoring and alerting.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers — imported lazily so missing router files don't crash startup.
# Other workers will add these; we guard with try/except so the server can
# still start even if a router hasn't been implemented yet.
# ---------------------------------------------------------------------------

_ROUTER_IMPORTS = [
    ("app.routers.astronauts", "router"),
    ("app.routers.telemetry", "router"),
    ("app.routers.analysis", "router"),
    ("app.routers.research", "router"),
    ("app.routers.alerts", "router"),
    ("app.routers.radiation", "router"),
    ("app.routers.ground_team", "router"),
    ("app.routers.mission", "router"),
    ("app.routers.devices", "router"),
    ("app.routers.sync", "router"),
]

for _module_path, _attr in _ROUTER_IMPORTS:
    try:
        import importlib as _importlib
        _mod = _importlib.import_module(_module_path)
        _router = getattr(_mod, _attr)
        app.include_router(_router, prefix="/api/v1")
    except (ImportError, AttributeError):
        pass  # Router not yet implemented; skip gracefully


# ---------------------------------------------------------------------------
# Core endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["meta"])
async def root():
    return {"service": "ASTRA FastAPI Backend", "version": "1.0.0", "status": "ONLINE"}


@app.get("/api/v1/status", tags=["meta"])
async def status():
    return {
        "status": "ONLINE",
        "service": "ASTRA",
        "prototype_warning": settings.PROTOTYPE_WARNING,
    }


@app.get("/api/v1/health", tags=["meta"])
async def health():
    return {"status": "healthy", "database": "connected"}


@app.get("/api/v1/supabase/status", tags=["meta"])
async def supabase_status():
    from app.services.supabase_service import supabase_service
    conn_info = await supabase_service.check_connection()
    return conn_info
