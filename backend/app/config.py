from __future__ import annotations

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Relational Database (Local Onboard Storage)
    DATABASE_URL: str = "sqlite+aiosqlite:///./astra.db"
    FASTAPI_PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:8080"

    # Supabase Cloud Database & Realtime
    SUPABASE_URL: str = "https://cboiwmazdwworsyviimc.supabase.co"
    SUPABASE_ANON_KEY: str = "sb_publishable_3d23ok14hzADTZjyBNJ4Qw_MoTYszHJ"
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_ENABLED: bool = True

    # Ground Telemetry Gateway
    GROUND_TEAM_EMAIL: str = ""
    FLIGHT_SURGEON_EMAIL: str = ""
    EMAIL_GATEWAY_URL: str = ""
    EMAIL_GATEWAY_API_KEY: str = ""

    # Operational Parameters
    REQUEST_TIMEOUT_SECONDS: int = 30
    RESEARCH_REFRESH_INTERVAL_HOURS: int = 24
    PROTOTYPE_WARNING: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
