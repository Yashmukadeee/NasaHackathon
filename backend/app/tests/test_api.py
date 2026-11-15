from __future__ import annotations

import pytest
from starlette.testclient import TestClient
from app.main import app


def test_root_endpoint():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "ASTRA FastAPI Backend"
        assert data["status"] == "ONLINE"


def test_health_and_status_endpoints():
    with TestClient(app) as client:
        res1 = client.get("/api/v1/status")
        res2 = client.get("/api/v1/health")
        assert res1.status_code == 200
        assert res1.json()["status"] == "ONLINE"
        assert res2.status_code == 200
        assert res2.json()["status"] == "healthy"


def test_astronauts_endpoints():
    with TestClient(app) as client:
        response = client.get("/api/v1/astronauts")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        ids = [a["id"] for a in data]
        assert "ASTRO-1" in ids


def test_telemetry_get_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/telemetry/ASTRO-1?from=1&to=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        assert data[0]["mission_day"] == 1
        assert "hr" in data[0]


def test_analysis_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/analysis/ASTRO-1?day=45")
        assert response.status_code == 200
        data = response.json()
        assert data["day"] == 45
        assert "overall" in data
        assert "domains" in data


def test_ground_team_contacts_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/ground-team/contacts")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        roles = [c["role"] for c in data]
        assert "Flight Surgeon" in roles


def test_emergency_report_creation_and_status():
    with TestClient(app) as client:
        # Create an emergency report
        rep_res = client.post("/api/v1/ground-team/emergency-report", json={
            "astronaut_id": "ASTRO-1",
            "mission_day": 45,
            "reason": "Test critical simulation alert"
        })
        assert rep_res.status_code == 200
        rep_data = rep_res.json()
        assert rep_data["success"] is True
        report_id = rep_data["report_id"]

        # Check status
        stat_res = client.get(f"/api/v1/ground-team/communication-status/{report_id}")
        assert stat_res.status_code == 200
        stat_data = stat_res.json()
        assert stat_data["report_id"] == report_id
        assert stat_data["communication_status"] in ("queued", "transmitted")


def test_sync_router_and_new_endpoints():
    with TestClient(app) as client:
        # 1. Sync pending
        pending_res = client.get("/api/v1/sync/pending")
        assert pending_res.status_code == 200
        assert "pending_emergency_reports_count" in pending_res.json()

        # 2. Batch sync
        sync_res = client.post("/api/v1/sync/batch", json={
            "astronaut_id": "ASTRO-1",
            "records": [
                {
                    "record_type": "telemetry",
                    "astronaut_id": "ASTRO-1",
                    "mission_day": 50,
                    "data": {"hr": 72, "spo2": 98.0, "source": "test_sync"}
                }
            ]
        })
        assert sync_res.status_code == 200
        assert sync_res.json()["synced_count"] == 1

        # 3. Overall communication status
        comm_res = client.get("/api/v1/ground-team/communication-status")
        assert comm_res.status_code == 200
        assert comm_res.json()["link_state"] == "NOMINAL_UPLINK"

        # 4. Research analyze
        res_an = client.post("/api/v1/research/analyze", json={"domain": "car", "tier": 1})
        assert res_an.status_code == 200
        assert "evidence" in res_an.json()

        # 5. Analysis latest
        latest_res = client.get("/api/v1/analysis/ASTRO-1/latest")
        assert latest_res.status_code == 200
        assert latest_res.json()["astronaut_id"] == "ASTRO-1"

        # 6. Alerts by astronaut
        alerts_res = client.get("/api/v1/alerts/ASTRO-1")
        assert alerts_res.status_code == 200
        assert isinstance(alerts_res.json(), list)
