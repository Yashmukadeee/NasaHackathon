from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict


class GroundContactBase(BaseModel):
    role: str
    name: str
    contact_info: Optional[str] = None
    is_configured: bool = False


class GroundContactCreate(GroundContactBase):
    pass


class GroundContactResponse(GroundContactBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
