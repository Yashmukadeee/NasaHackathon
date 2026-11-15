from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from app.devices.base import ConnectionState, WearableDeviceAdapter

logger = logging.getLogger("astra.devices.ble")

# Standard Bluetooth SIG Medical GATT Specifications
GATT_SERVICES = {
    "0x180D": {"name": "Heart Rate Service", "metrics": ["hr"]},
    "0x1822": {"name": "Pulse Oximeter Service", "metrics": ["spo2"]},
    "0x1809": {"name": "Health Thermometer Service", "metrics": ["temp"]},
    "0x1810": {"name": "Blood Pressure Service", "metrics": ["sbp", "dbp"]},
}


class BLEWearableAdapter(WearableDeviceAdapter):
    """
    Adapter for Bluetooth Low Energy (BLE 5.0+) smart garments and clinical biometric patches.
    Integrates GATT Heart Rate, SpO2, and Skin Thermometry characteristics.
    """

    def __init__(
        self,
        device_id: str,
        astronaut_id: str,
        device_name: str = "AstroSkin Smart Garment",
        mac_address: Optional[str] = None,
        supported_metrics: Optional[list[str]] = None,
    ):
        super().__init__(
            device_id=device_id,
            astronaut_id=astronaut_id,
            device_name=device_name,
            device_type="smart_garment",
            protocol="BLE",
            supported_metrics=supported_metrics or ["hr", "hrv", "spo2", "temp", "ex"],
        )
        self.mac_address = mac_address or "E2:4C:89:12:F4:A0"
        self.rssi_dbm = -65  # Received signal strength indicator
        self._connected = False

    async def connect(self) -> bool:
        """Simulate or execute BLE GATT connection handshake."""
        logger.info("[BLE Adapter] Pairing with %s (%s)...", self.device_name, self.mac_address)
        self._connected = True
        self.connection_state = ConnectionState.CONNECTED
        self.signal_quality = 0.95
        return True

    async def disconnect(self) -> bool:
        """Terminate BLE connection."""
        logger.info("[BLE Adapter] Disconnecting %s", self.device_id)
        self._connected = False
        self.connection_state = ConnectionState.DISCONNECTED
        return True

    def parse_gatt_heart_rate_measurement(self, raw_bytes: bytes) -> dict[str, Any]:
        """
        Parse Bluetooth SIG standard Heart Rate Measurement (Characteristic 0x2A37).
        Byte 0: Flags (Bit 0: 8-bit vs 16-bit HR; Bit 4: RR-Interval present)
        """
        if not raw_bytes:
            return {}

        flags = raw_bytes[0]
        hr_16bit = bool(flags & 0x01)
        rr_present = bool(flags & 0x10)

        offset = 1
        if hr_16bit:
            hr = int.from_bytes(raw_bytes[offset:offset + 2], byteorder="little")
            offset += 2
        else:
            hr = raw_bytes[offset]
            offset += 1

        rr_ms = None
        if rr_present and len(raw_bytes) >= offset + 2:
            rr_raw = int.from_bytes(raw_bytes[offset:offset + 2], byteorder="little")
            rr_ms = round(rr_raw * 1000.0 / 1024.0, 1)  # 1/1024 second resolution

        self.last_reading_at = datetime.now(timezone.utc)
        self.total_packets_received += 1

        return {
            "hr": hr,
            "hrv": rr_ms or 50.0,
            "timestamp": self.last_reading_at.isoformat(),
        }
