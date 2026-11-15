from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
import httpx
from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger("astra.supabase")


class SupabaseService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.anon_key = settings.SUPABASE_ANON_KEY
        self.enabled = settings.SUPABASE_ENABLED
        self._client: Optional[Client] = None
        self._is_online = False
        self._init_client()

    def _init_client(self):
        if not self.enabled or not self.url or not self.key:
            self._is_online = False
            return
        try:
            self._client = create_client(self.url, self.key)
            self._is_online = True
            logger.info("[ASTRA] Supabase client initialized for %s", self.url)
        except Exception as e:
            logger.warning("[ASTRA] Supabase client initialization failed: %s", e)
            self._is_online = False

    @property
    def is_online(self) -> bool:
        return self._is_online and self._client is not None

    async def check_connection(self) -> dict:
        """Probe Supabase health and accessibility."""
        if not self.enabled:
            return {
                "status": "DISABLED",
                "online": False,
                "provider": "Local SQLite",
                "project_id": "cboiwmazdwworsyviimc",
            }
        key_to_use = self.key or self.anon_key
        try:
            async with httpx.AsyncClient(timeout=4.0) as http_client:
                headers = {
                    "apikey": key_to_use,
                    "Authorization": f"Bearer {key_to_use}",
                }
                res = await http_client.get(f"{self.url}/rest/v1/", headers=headers)
                online = res.status_code == 200
                self._is_online = online
                return {
                    "status": "CONNECTED" if online else "UNREACHABLE",
                    "online": online,
                    "http_status": res.status_code,
                    "url": self.url,
                    "project_id": "cboiwmazdwworsyviimc",
                }
        except Exception as e:
            self._is_online = False
            return {
                "status": "OFFLINE_BUFFERING",
                "online": False,
                "error": str(e),
                "url": self.url,
                "project_id": "cboiwmazdwworsyviimc",
            }

    async def insert_telemetry_reading(self, reading: dict) -> dict:
        """
        Store a real-time telemetry reading in Supabase.
        Gracefully handles offline or unmigrated table state.
        """
        if not self.is_online:
            return {"synced": False, "storage": "local_buffered", "reason": "Supabase offline"}

        try:
            # Format payload for telemetry_readings
            payload = {
                "sequence_number": reading.get("sequence_number", int(datetime.now(timezone.utc).timestamp())),
                "astronaut_id": reading["astronaut_id"],
                "device_id": reading["device_id"],
                "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "metric_name": reading["metric_name"],
                "metric_value": float(reading["metric_value"]),
                "unit": reading.get("unit", ""),
                "signal_quality": float(reading.get("signal_quality", 1.0)),
                "device_source": reading.get("device_source", "wearable_ble"),
                "measurement_provenance": reading.get("measurement_provenance", {}),
                "is_synced": True,
            }

            # Use postgrest via supabase client
            res = self._client.table("telemetry_readings").insert(payload).execute()
            return {"synced": True, "storage": "supabase_cloud", "data": res.data}
        except Exception as e:
            logger.debug("[ASTRA] Supabase telemetry insert fallback: %s", e)
            return {"synced": False, "storage": "local_buffered", "reason": str(e)}

    async def update_device_status(self, device_id: str, status_data: dict) -> dict:
        """Update or insert device live status in Supabase."""
        if not self.is_online:
            return {"synced": False, "storage": "local"}

        try:
            payload = {
                "device_id": device_id,
                "astronaut_id": status_data.get("astronaut_id"),
                "connection_state": status_data.get("connection_state", "CONNECTED"),
                "battery_level": status_data.get("battery_level", 100),
                "last_reading_at": datetime.now(timezone.utc).isoformat(),
                "signal_quality": status_data.get("signal_quality", 1.0),
                "transmission_frequency_hz": status_data.get("transmission_frequency_hz", 1.0),
                "sensor_availability": status_data.get("sensor_availability", {}),
                "sync_status": "SYNCHRONIZED",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            res = self._client.table("device_status").upsert(payload).execute()
            return {"synced": True, "data": res.data}
        except Exception as e:
            return {"synced": False, "reason": str(e)}

    async def insert_health_alert(self, alert_data: dict) -> dict:
        """Insert health alert into Supabase."""
        if not self.is_online:
            return {"synced": False, "storage": "local"}

        try:
            payload = {
                "astronaut_id": alert_data["astronaut_id"],
                "mission_day": alert_data.get("mission_day", 1),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "tier": alert_data.get("tier", 1),
                "category": alert_data.get("category", "ATTENTION"),
                "domain": alert_data.get("domain", "car"),
                "affected_metric": alert_data.get("affected_metric", "hr"),
                "current_value": alert_data.get("current_value"),
                "baseline_value": alert_data.get("baseline_value"),
                "deviation_sd": alert_data.get("deviation_sd"),
                "message": alert_data.get("message", ""),
                "recommended_action": alert_data.get("recommended_action", ""),
                "research_citations": alert_data.get("research_citations", []),
            }
            res = self._client.table("health_alerts").insert(payload).execute()
            return {"synced": True, "data": res.data}
        except Exception as e:
            return {"synced": False, "reason": str(e)}


# Global singleton instance
supabase_service = SupabaseService()
