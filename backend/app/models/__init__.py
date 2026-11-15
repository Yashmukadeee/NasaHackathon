from __future__ import annotations

# Import all models so they register with Base before create_all is called.
from app.models.astronaut import Astronaut, Baseline  # noqa: F401
from app.models.telemetry import Telemetry  # noqa: F401
from app.models.alerts import Alert, AuditLog, CommunicationHistory, EmergencyReport  # noqa: F401
from app.models.research import (  # noqa: F401
    ResearchDocument,
    ResearchFinding,
    ResearchMapping,
    ResearchSource,
    RiskKnowledge,
)
from app.models.ground_contact import GroundContact  # noqa: F401

__all__ = [
    "Astronaut",
    "Baseline",
    "Telemetry",
    "Alert",
    "AuditLog",
    "CommunicationHistory",
    "EmergencyReport",
    "ResearchDocument",
    "ResearchFinding",
    "ResearchMapping",
    "ResearchSource",
    "RiskKnowledge",
    "GroundContact",
]
