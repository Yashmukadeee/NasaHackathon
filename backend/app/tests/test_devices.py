from __future__ import annotations

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.devices.normalizer import TelemetryNormalizer
from app.services.realtime_pipeline import realtime_pipeline


def test_supabase_status_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/supabase/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "online" in data
        assert "project_id" in data
        assert data["project_id"] == "cboiwmazdwworsyviimc"


def test_device_registry_and_lifecycle():
    with TestClient(app) as client:
        # 1. List pre-registered devices
        res = client.get("/api/v1/devices")
        assert res.status_code == 200
        devices = res.json()
        assert len(devices) >= 3
        device_ids = [d["device_id"] for d in devices]
        assert "ASTRO-BIO-01" in device_ids

        # 2. Register a new device
        reg_res = client.post("/api/v1/devices/register", json={
            "device_id": "TEST-DEV-99",
            "device_name": "Test Hexoskin Monitor",
            "device_type": "smart_shirt",
            "protocol": "BLE",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "assigned_astronaut_id": "ASTRO-1"
        })
        assert reg_res.status_code == 200
        assert reg_res.json()["registered"] is True

        # 3. Connect device
        conn_res = client.post("/api/v1/devices/TEST-DEV-99/connect")
        assert conn_res.status_code == 200
        assert conn_res.json()["status"] == "CONNECTED"

        # 4. Check device status
        stat_res = client.get("/api/v1/devices/TEST-DEV-99/status")
        assert stat_res.status_code == 200
        stat = stat_res.json()
        assert stat["state"] == "CONNECTED"
        assert stat["device_id"] == "TEST-DEV-99"

        # 5. Disconnect device
        disc_res = client.post("/api/v1/devices/TEST-DEV-99/disconnect")
        assert disc_res.status_code == 200
        assert disc_res.json()["status"] == "DISCONNECTED"


def test_simulate_packet_endpoint():
    with TestClient(app) as client:
        # Simulate packet for ASTRO-BIO-01 in nominal mode
        res = client.post("/api/v1/devices/ASTRO-BIO-01/simulate-packet?mode=nominal")
        assert res.status_code == 200
        data = res.json()
        assert data["device_id"] == "ASTRO-BIO-01"
        assert "packet" in data
        assert "analysis" in data
        assert "hr" in data["packet"]
        assert data["analysis"]["success"] is True

        # Simulate packet in fever mode to verify abnormal detection
        fever_res = client.post("/api/v1/devices/ASTRO-BIO-01/simulate-packet?mode=fever")
        assert fever_res.status_code == 200
        fever_data = fever_res.json()
        assert fever_data["packet"]["temp"] >= 38.0
        # Fever generates an alert
        assert fever_data["analysis"]["alert"] is not None


def test_telemetry_ingest_and_live_read():
    with TestClient(app) as client:
        # Ingest telemetry via POST /api/v1/telemetry/ingest
        payload = {
            "device_id": "ASTRO-BIO-01",
            "astronaut_id": "ASTRO-1",
            "readings": {
                "hr": 74.0,
                "spo2": 98.2,
                "temp": 36.8,
                "resp_rate": 14.5
            },
            "source": "wearable",
            "signal_quality": 0.96
        }
        ingest_res = client.post("/api/v1/telemetry/ingest", json=payload)
        assert ingest_res.status_code == 200
        res_data = ingest_res.json()
        assert res_data["success"] is True
        assert "analysis" in res_data

        # Verify live telemetry retrieval
        live_res = client.get("/api/v1/telemetry/live/ASTRO-1")
        assert live_res.status_code == 200
        live_data = live_res.json()
        assert live_data["astronaut_id"] == "ASTRO-1"
        assert live_data["readings"]["hr"] == 74.0


def test_telemetry_normalizer_unit_conversions_and_bounds():
    normalizer = TelemetryNormalizer()

    # Fahrenheit to Celsius
    raw_f = {"temp": 98.6}  # 98.6°F is 37.0°C
    norm_f, units_f, flags_f = normalizer.normalize(raw_f)
    assert abs(norm_f["temp"] - 37.0) < 0.1
    assert "temp" not in flags_f

    # Extreme bounds check (e.g. impossible HR 450 bpm)
    raw_invalid = {"hr": 450.0}
    norm_inv, units_inv, flags_inv = normalizer.normalize(raw_invalid)
    assert "hr" in flags_inv
    assert "OUT_OF_BOUNDS" in flags_inv["hr"]


@pytest.mark.anyio
async def test_realtime_pipeline_analysis():
    # Nominal packet
    packet = {
        "device_id": "ASTRO-BIO-01",
        "astronaut_id": "ASTRO-1",
        "readings": {
            "hr": 68.0,
            "spo2": 98.5,
            "temp": 36.7
        },
        "signal_quality": 0.98
    }
    result = await realtime_pipeline.ingest_and_process(packet)
    assert result["success"] is True
    assert result["alert"] is None

    # Hypoxia packet -> should trigger alert
    hypoxia_packet = {
        "device_id": "ASTRO-BIO-01",
        "astronaut_id": "ASTRO-1",
        "readings": {
            "hr": 105.0,
            "spo2": 88.0,  # low spo2 triggers alert
            "temp": 36.6
        },
        "signal_quality": 0.95
    }
    hyp_result = await realtime_pipeline.ingest_and_process(hypoxia_packet)
    assert hyp_result["success"] is True
    assert hyp_result["alert"] is not None
    alert_metrics = [a["metric"] for a in hyp_result["alerts"]]
    assert "spo2" in alert_metrics
