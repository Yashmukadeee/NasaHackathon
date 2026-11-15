from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class ConnectionState(str, Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    RECONNECTING = "RECONNECTING"
    DATA_STALE = "DATA_STALE"
    OFFLINE_BUFFERING = "OFFLINE_BUFFERING"


class WearableDeviceAdapter(ABC):
    """
    Abstract base class for all astronaut wearable device integrations.
    Supports BLE smart garments, wireless pulse oximeters, biosensor patches, and simulators.
    """

    def __init__(
        self,
        device_id: str,
        astronaut_id: str,
        device_name: str,
        device_type: str,
        protocol: str = "BLE",
        supported_metrics: Optional[list[str]] = None,
    ):
        self.device_id = device_id
        self.astronaut_id = astronaut_id
        self.device_name = device_name
        self.device_type = device_type
        self.protocol = protocol
        self.supported_metrics = supported_metrics or ["hr", "hrv", "spo2", "temp"]
        self.connection_state = ConnectionState.DISCONNECTED
        self.battery_level = 100
        self.signal_quality = 1.0
        self.transmission_frequency_hz = 1.0
        self.last_reading_at: Optional[datetime] = None
        self.total_packets_received = 0
        self.dropped_packets = 0

    @abstractmethod
    async def connect(self) -> bool:
        """Initiate connection to physical or virtual wearable hardware."""
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        """Gracefully disconnect from wearable device."""
        pass

    def get_status(self) -> dict[str, Any]:
        """Return standardized device health and connectivity report."""
        # Detect data staleness (> 30 seconds since last reading while marked connected)
        state = self.connection_state
        if state == ConnectionState.CONNECTED and self.last_reading_at:
            delta = (datetime.now(timezone.utc) - self.last_reading_at).total_seconds()
            if delta > 30.0:
                state = ConnectionState.DATA_STALE

        return {
            "device_id": self.device_id,
            "astronaut_id": self.astronaut_id,
            "device_name": self.device_name,
            "device_type": self.device_type,
            "protocol": self.protocol,
            "connection_state": state.value,
            "state": state.value,
            "battery_level": self.battery_level,
            "last_reading_at": self.last_reading_at.isoformat() if self.last_reading_at else None,
            "transmission_frequency_hz": self.transmission_frequency_hz,
            "signal_quality": self.signal_quality,
            "supported_metrics": self.supported_metrics,
            "total_packets": self.total_packets_received,
            "dropped_packets": self.dropped_packets,
            "sync_status": "SYNCHRONIZED" if state == ConnectionState.CONNECTED else "BUFFERED",
        }
