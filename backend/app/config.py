from __future__ import annotations

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


def _env_list(name: str, default: str) -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings(BaseSettings):
    # Relational Database (Local Onboard Storage)
    DATABASE_URL: str = "sqlite+aiosqlite:///./astra.db"
    FASTAPI_PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:8080"
    # Additional browser origins allowed to call the API (comma separated).
    # localhost and 127.0.0.1 are both common when serving the static app.
    EXTRA_CORS_ORIGINS: str = (
        "http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
    )

    # Supabase Cloud Database & Realtime.
    # No credentials are hardcoded here: set them in backend/.env (see .env.example).
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_ENABLED: bool = True

    # Ground Telemetry Gateway
    GROUND_TEAM_EMAIL: str = ""
    FLIGHT_SURGEON_EMAIL: str = ""
    EMAIL_GATEWAY_URL: str = ""
    EMAIL_GATEWAY_API_KEY: str = ""

    # Security & API Authentication Key.
    # Empty by default = endpoint authentication disabled. Set it in backend/.env
    # to require a key on /api/v1/analysis/assess. A key shipped to a browser is
    # public by definition; treat it as a demo gate, not a real secret.
    FASTAPI_API_KEY: str = ""

    # Operational Parameters
    REQUEST_TIMEOUT_SECONDS: int = 30
    RESEARCH_REFRESH_INTERVAL_HOURS: int = 24
    PROTOTYPE_WARNING: bool = True

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            self.FRONTEND_ORIGIN,
            *_env_list("ASTRA_EXTRA_CORS_ORIGINS", self.EXTRA_CORS_ORIGINS),
        ]
        # Deduplicate while preserving order.
        return list(dict.fromkeys(origins))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
