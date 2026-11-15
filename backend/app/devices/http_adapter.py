from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from app.devices.base import ConnectionState, WearableDeviceAdapter

logger = logging.getLogger("astra.devices.http")


class HttpGatewayAdapter(WearableDeviceAdapter):
    """
    Adapter for onboard LAN Wi-Fi or Ethernet device gateways that push
    telemetry via REST or WebSocket from medical hubs (e.g. BioRadio / Medical Consoles).
    """

    def __init__(
        self,
        device_id: str,
        astronaut_id: str,
        device_name: str = "Onboard Medical Station Gateway",
        gateway_endpoint: Optional[str] = None,
        supported_metrics: Optional[list[str]] = None,
    ):
        super().__init__(
            device_id=device_id,
            astronaut_id=astronaut_id,
            device_name=device_name,
            device_type="medical_gateway",
            protocol="HTTP_GATEWAY",
            supported_metrics=supported_metrics or ["hr", "hrv", "spo2", "temp", "sbp", "dbp", "dose"],
        )
        self.gateway_endpoint = gateway_endpoint or "http://192.168.1.105:8088/telemetry"
        self.api_token = "GATEWAY_AUTH_BEARER_TOKEN"

    async def connect(self) -> bool:
        logger.info("[HTTP Gateway] Connecting to onboard gateway at %s", self.gateway_endpoint)
        self.connection_state = ConnectionState.CONNECTED
        self.signal_quality = 1.0
        return True

    async def disconnect(self) -> bool:
        logger.info("[HTTP Gateway] Disconnecting gateway %s", self.device_id)
        self.connection_state = ConnectionState.DISCONNECTED
        return True

    def process_incoming_batch(self, batch_payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.last_reading_at = datetime.now(timezone.utc)
        self.total_packets_received += len(batch_payload)
        return batch_payload
