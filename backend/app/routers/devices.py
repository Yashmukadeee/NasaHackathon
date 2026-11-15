from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.devices.device_manager import device_manager
from app.services.realtime_pipeline import realtime_pipeline
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/devices", tags=["wearable-devices"])


class DeviceRegisterRequest(BaseModel):
    device_id: str = Field(..., description="Unique hardware identifier (MAC or serial)")
    astronaut_id: Optional[str] = Field(None, description="Assigned astronaut ID (e.g. ASTRO-1)")
    assigned_astronaut_id: Optional[str] = Field(None, description="Alias for assigned astronaut ID")
    device_name: str = Field("Wearable Sensor", description="Human readable device label")
    device_type: str = Field("bio_patch", description="bio_patch, smart_garment, smart_ring, or dosimeter")
    protocol: str = Field("BLE", description="BLE, WIFI, or HTTP_GATEWAY")
    mac_address: Optional[str] = None
    supported_metrics: Optional[list[str]] = None

    @property
    def target_astronaut_id(self) -> str:
        return self.astronaut_id or self.assigned_astronaut_id or "ASTRO-1"


@router.get("")
async def list_devices(astronaut_id: Optional[str] = Query(None)):
    """List all registered astronaut wearable monitoring devices."""
    if astronaut_id:
        devices = device_manager.get_devices_for_astronaut(astronaut_id)
        return [d.get_status() for d in devices]
    return device_manager.list_all_devices()


@router.post("/register")
async def register_device(req: DeviceRegisterRequest):
    """Register a new wearable health monitoring device."""
    astro_id = req.target_astronaut_id
    adapter = device_manager.register_device(
        device_id=req.device_id,
        astronaut_id=astro_id,
        device_name=req.device_name,
        device_type=req.device_type,
        protocol=req.protocol,
        supported_metrics=req.supported_metrics,
    )
    # Sync registration to Supabase
    await supabase_service.update_device_status(req.device_id, adapter.get_status())
    return {
        "success": True,
        "registered": True,
        "message": f"Device {req.device_id} registered and bound to {astro_id}",
        "device": adapter.get_status(),
    }


@router.post("/{device_id}/connect")
async def connect_device(device_id: str):
    """Initiate connection to wearable device."""
    success = await device_manager.connect_device(device_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    dev = device_manager.get_device(device_id)
    status = dev.get_status() if dev else {}
    await supabase_service.update_device_status(device_id, status)
    return {"success": True, "status": "CONNECTED", "device": status}


@router.post("/{device_id}/disconnect")
async def disconnect_device(device_id: str):
    """Disconnect wearable device."""
    success = await device_manager.disconnect_device(device_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    dev = device_manager.get_device(device_id)
    status = dev.get_status() if dev else {}
    await supabase_service.update_device_status(device_id, status)
    return {"success": True, "status": "DISCONNECTED", "device": status}


@router.get("/{device_id}/status")
async def get_device_status(device_id: str):
    """Get live connection state, battery, and signal quality for a device."""
    dev = device_manager.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    status = dev.get_status()
    # Update Supabase device_status
    await supabase_service.update_device_status(device_id, status)
    return status


@router.post("/{device_id}/simulate-packet")
async def simulate_wearable_packet(device_id: str, mode: str = Query("nominal")):
    """
    [LABELED HARDWARE EMULATION ENDPOINT]
    Triggers a live telemetry burst from a simulator adapter for real-time testing.
    """
    dev = device_manager.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    from app.devices.simulator_adapter import WearableSimulatorAdapter
    if isinstance(dev, WearableSimulatorAdapter):
        dev.mode = mode
        packets = dev.generate_sample_packet()
        results = []
        for p in packets:
            res = await realtime_pipeline.ingest_and_process(p)
            results.append(res)
        return {
            "success": True,
            "device_id": device_id,
            "mode": mode,
            "packets_emitted": len(packets),
            "packet": {p["metric_name"]: p["metric_value"] for p in packets},
            "analysis": results[0] if results else {},
            "processed": results,
        }

    return {"success": False, "message": "Device is not in simulation adapter mode"}
