from __future__ import annotations

import logging
from typing import Any, Optional
from app.devices.base import ConnectionState, WearableDeviceAdapter
from app.devices.ble_adapter import BLEWearableAdapter
from app.devices.http_adapter import HttpGatewayAdapter
from app.devices.simulator_adapter import WearableSimulatorAdapter

logger = logging.getLogger("astra.devices.manager")


class DeviceManager:
    """
    Central gateway registry managing astronaut wearable devices,
    heartbeats, connection lifecycle, and stream routing.
    """

    def __init__(self):
        self._devices: dict[str, WearableDeviceAdapter] = {}
        self._seed_default_devices()

    def _seed_default_devices(self):
        # Register standard mission devices
        d1 = WearableSimulatorAdapter(
            device_id="ASTRO-BIO-01",
            astronaut_id="ASTRO-1",
            device_name="BioSticker Patch #01 (Commander)",
            mode="nominal",
        )
        d1.connection_state = ConnectionState.CONNECTED

        d2 = BLEWearableAdapter(
            device_id="ASTRO-GARMENT-02",
            astronaut_id="ASTRO-2",
            device_name="AstroSkin Smart Garment #02 (CMO)",
        )
        d2.connection_state = ConnectionState.CONNECTED

        d3 = WearableSimulatorAdapter(
            device_id="ASTRO-RING-03",
            astronaut_id="ASTRO-3",
            device_name="Crew Circadian Ring #03 (Engineer)",
            mode="nominal",
        )
        d3.connection_state = ConnectionState.CONNECTED

        self._devices[d1.device_id] = d1
        self._devices[d2.device_id] = d2
        self._devices[d3.device_id] = d3

    def register_device(
        self,
        device_id: str,
        astronaut_id: str,
        device_name: str,
        device_type: str = "bio_patch",
        protocol: str = "BLE",
        supported_metrics: Optional[list[str]] = None,
    ) -> WearableDeviceAdapter:
        if protocol.upper() == "BLE":
            adapter = BLEWearableAdapter(device_id, astronaut_id, device_name, supported_metrics=supported_metrics)
        elif protocol.upper() == "HTTP_GATEWAY":
            adapter = HttpGatewayAdapter(device_id, astronaut_id, device_name, supported_metrics=supported_metrics)
        else:
            adapter = WearableSimulatorAdapter(device_id, astronaut_id, device_name)

        self._devices[device_id] = adapter
        logger.info("[Device Manager] Registered new device %s for %s", device_id, astronaut_id)
        return adapter

    def get_device(self, device_id: str) -> Optional[WearableDeviceAdapter]:
        return self._devices.get(device_id)

    def get_devices_for_astronaut(self, astronaut_id: str) -> list[WearableDeviceAdapter]:
        return [d for d in self._devices.values() if d.astronaut_id == astronaut_id]

    def list_all_devices(self) -> list[dict[str, Any]]:
        return [d.get_status() for d in self._devices.values()]

    async def connect_device(self, device_id: str) -> bool:
        dev = self.get_device(device_id)
        if not dev:
            return False
        return await dev.connect()

    async def disconnect_device(self, device_id: str) -> bool:
        dev = self.get_device(device_id)
        if not dev:
            return False
        return await dev.disconnect()


device_manager = DeviceManager()
