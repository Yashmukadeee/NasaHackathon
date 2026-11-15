from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./astra.db"
    FASTAPI_PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:8080"
    GROUND_TEAM_EMAIL: str = ""
    FLIGHT_SURGEON_EMAIL: str = ""
    EMAIL_GATEWAY_URL: str = ""
    EMAIL_GATEWAY_API_KEY: str = ""
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
