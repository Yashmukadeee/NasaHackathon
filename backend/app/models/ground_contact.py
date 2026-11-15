from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class GroundContact(Base):
    __tablename__ = "ground_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    contact_info: Mapped[str | None] = mapped_column(String, nullable=True)
    is_configured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
