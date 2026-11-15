from __future__ import annotations

import logging
import math
import random
from datetime import datetime, timezone
from typing import Any, Optional
from app.devices.base import ConnectionState, WearableDeviceAdapter

logger = logging.getLogger("astra.devices.simulator")


class WearableSimulatorAdapter(WearableDeviceAdapter):
    """
    [LABELED SIMULATION ADAPTER]
    Provides physiological telemetry simulation for flight testing and demonstration
    when physical Bluetooth Low Energy / Vendor hardware is in transit or unpowered.

    HARDWARE REMAINING FOR PHYSICAL PRODUCTION:
    - Direct pairing with Nordic Semiconductor nRF52 BLE dongle.
    - Vendor SDK binding (e.g. Carré Technologies AstroSkin SDK for Windows/Linux).
    - Pairing with physical Polar H10 or BioSticker device MAC addresses.
    """

    def __init__(
        self,
        device_id: str = "SIM-WEARABLE-01",
        astronaut_id: str = "ASTRO-1",
        device_name: str = "AstroSkin BLE Simulator (Hardware Emulation)",
        mode: str = "nominal",  # 'nominal', 'arrhythmia', 'fever', 'hypoxia'
    ):
        super().__init__(
            device_id=device_id,
            astronaut_id=astronaut_id,
            device_name=device_name,
            device_type="hardware_emulator",
            protocol="BLE_SIMULATED",
            supported_metrics=["hr", "hrv", "spo2", "temp", "sbp", "dbp", "ex"],
        )
        self.mode = mode
        self.battery_level = 95
        self.step_counter = 0

    async def connect(self) -> bool:
        logger.info("[Simulator Adapter] Emulating connection to %s", self.device_id)
        self.connection_state = ConnectionState.CONNECTED
        self.signal_quality = 0.98
        return True

    async def disconnect(self) -> bool:
        logger.info("[Simulator Adapter] Emulating disconnect for %s", self.device_id)
        self.connection_state = ConnectionState.DISCONNECTED
        return True

    def generate_sample_packet(self) -> list[dict[str, Any]]:
        """Generate realistic real-time telemetry sample based on active mode."""
        now = datetime.now(timezone.utc)
        self.step_counter += 1
        t = self.step_counter

        # Base nominal parameters
        base_hr = 68.0 + 3.0 * math.sin(t * 0.1) + random.uniform(-1.5, 1.5)
        base_hrv = 55.0 + 4.0 * math.cos(t * 0.1) + random.uniform(-2.0, 2.0)
        base_spo2 = 98.2 + random.uniform(-0.3, 0.3)
        base_temp = 36.65 + random.uniform(-0.05, 0.05)
        base_sbp = 118.0 + random.uniform(-2.0, 2.0)
        base_dbp = 78.0 + random.uniform(-1.5, 1.5)

        # Mode modifications
        if self.mode == "fever":
            base_temp += 1.8  # 38.45°C
            base_hr += 22.0   # Tachycardia
            base_hrv -= 18.0  # Reduced autonomic regulation
        elif self.mode == "hypoxia":
            base_spo2 -= 8.5  # 89.7%
            base_hr += 18.0
        elif self.mode == "arrhythmia":
            base_hr += random.choice([-25.0, 35.0])
            base_hrv = max(10.0, base_hrv - 30.0)

        self.last_reading_at = now
        self.total_packets_received += 1

        seq = int(now.timestamp())
        packets = [
            {
                "astronaut_id": self.astronaut_id,
                "device_id": self.device_id,
                "sequence_number": seq,
                "timestamp": now.isoformat(),
                "metric_name": "hr",
                "metric_value": round(base_hr, 1),
                "unit": "bpm",
                "signal_quality": self.signal_quality,
                "device_source": "simulator_ble",
                "measurement_provenance": {"simulated": True, "mode": self.mode},
            },
            {
                "astronaut_id": self.astronaut_id,
                "device_id": self.device_id,
                "sequence_number": seq,
                "timestamp": now.isoformat(),
                "metric_name": "hrv",
                "metric_value": round(base_hrv, 1),
                "unit": "ms",
                "signal_quality": self.signal_quality,
                "device_source": "simulator_ble",
                "measurement_provenance": {"simulated": True, "mode": self.mode},
            },
            {
                "astronaut_id": self.astronaut_id,
                "device_id": self.device_id,
                "sequence_number": seq,
                "timestamp": now.isoformat(),
                "metric_name": "spo2",
                "metric_value": round(min(100.0, max(80.0, base_spo2)), 1),
                "unit": "%",
                "signal_quality": self.signal_quality,
                "device_source": "simulator_ble",
                "measurement_provenance": {"simulated": True, "mode": self.mode},
            },
            {
                "astronaut_id": self.astronaut_id,
                "device_id": self.device_id,
                "sequence_number": seq,
                "timestamp": now.isoformat(),
                "metric_name": "temp",
                "metric_value": round(base_temp, 2),
                "unit": "°C",
                "signal_quality": self.signal_quality,
                "device_source": "simulator_ble",
                "measurement_provenance": {"simulated": True, "mode": self.mode},
            },
        ]

        return packets
