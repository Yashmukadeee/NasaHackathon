# ASTRA – Astronaut Health Intelligence System (Backend)

NASA Space Apps Challenge – Long-Duration Spaceflight Health Monitoring

The ASTRA backend is a high-performance Python FastAPI service providing clinical telemetry analytics, spaceflight risk forecasting, multi-tier emergency escalation, offline-first ground communication management, and deep NASA/CSA research intelligence integration.

---

## Architecture Overview

```
backend/
├── app/
│   ├── config.py              # Environment configuration (pydantic-settings)
│   ├── database.py            # Async SQLAlchemy engine with SQLite/PostgreSQL support
│   ├── main.py                # FastAPI application, CORS, lifespan, router registry
│   ├── models/                # SQLAlchemy database models
│   │   ├── alerts.py          # Alert, EmergencyReport, CommunicationHistory, AuditLog
│   │   ├── astronaut.py       # Astronaut roster and baseline records
│   │   ├── ground_contact.py  # Ground team medical officers & flight surgeons
│   │   ├── research.py        # NASA/CSA knowledge base & finding mappings
│   │   └── telemetry.py       # 17-parameter mission telemetry store
│   ├── schemas/               # Pydantic validation schemas
│   ├── services/              # Core computational and intelligence services
│   │   ├── health_engine.py   # Baseline, z-score, EWMA drift, synergy rules
│   │   ├── anomaly_detection.py # Statistical anomaly & outlier detection
│   │   ├── risk_prediction.py # Linear projection & trajectory forecasting
│   │   ├── radiation_analysis.py # Cumulative dose, SPE detection, CSA instruments
│   │   ├── escalation_engine.py # Multi-tier escalation logic (Tier 0 to Tier 3)
│   │   ├── ground_communication.py # Offline queuing & ground gateway integration
│   │   ├── nasa_research.py   # Hardcoded official NASA/CSA findings
│   │   ├── evidence_mapping.py# Metric-to-research and domain mapping
│   │   └── research_retrieval.py # Ingestion engine for 5 allowlisted URLs
│   ├── routers/               # REST API endpoints (/api/v1/...)
│   └── tests/                 # Automated pytest test suite
├── astra.db                   # Local SQLite storage (auto-generated)
├── requirements.txt           # Python dependencies
└── .env.example               # Template environment configuration
```

---

## 5 NASA & CSA Knowledge Base Ingestion Sources

1. **NASA HRP Hazards:** `https://www.nasa.gov/hrp/hazards/`
2. **NASA HRP Risks:** `https://www.nasa.gov/hrp/risks/`
3. **NASA HRP Research:** `https://www.nasa.gov/hrp/ongoing-hrp-research/`
4. **CSA Radiation Monitoring:** `https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp`
5. **CSA Space Science:** `https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp`

---

## Setup & Running

### 1. Requirements
- Python 3.11+
- Virtual environment (recommended)

### 2. Installation
```powershell
cd backend
pip install -r requirements.txt
```

### 3. Running the Server
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. Running the Pytest Suite
```powershell
python -m pytest app/tests/ -v
```

---

## Operational Endpoints

Live route inventory, verified against `/openapi.json` (44 paths). Always confirm
with `GET /api/v1/status`, which reports `registered_routers`, `failed_routers`
and `route_count`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service root |
| `GET` | `/api/v1/status` | Status, registered/failed routers, route count |
| `GET` | `/api/v1/health` | Liveness probe |
| `GET` | `/api/v1/supabase/status` | Cloud database link state |
| `GET` | `/api/v1/astronauts` | Crew roster |
| `GET` | `/api/v1/astronauts/{astronaut_id}` | Single crew profile |
| `GET` | `/api/v1/mission/overview` | Mission metadata + crew roster |
| `GET` | `/api/v1/telemetry/{astronaut_id}` | Telemetry history (DB, else benchmark fallback) |
| `POST` | `/api/v1/telemetry` | Log one telemetry entry (upsert) |
| `POST` | `/api/v1/telemetry/batch` | Batch upsert telemetry |
| `POST` | `/api/v1/telemetry/ingest` | Real-time wearable reading through the CDSS pipeline |
| `GET` | `/api/v1/telemetry/live/{astronaut_id}` | Latest live wearable readings |
| `GET` | `/api/v1/telemetry/history/{astronaut_id}` | Real-time stream buffer |
| `GET` | `/api/v1/analysis/{astronaut_id}` | Health analysis (z-scores, EWMA drift, summary) |
| `POST` | `/api/v1/analysis/{astronaut_id}` | Same, with vitals overridden from the body |
| `POST` | `/api/v1/analysis/assess` | Full CDSS assessment: commands, citations, 7-day trajectories |
| `GET` | `/api/v1/analysis/{astronaut_id}/latest` | Analysis for the last mission day |
| `GET` | `/api/v1/analysis/{astronaut_id}/forecast` | 7-day metric trajectories |
| `GET` | `/api/v1/analysis/{astronaut_id}/history` | Per-day tier history |
| `GET` | `/api/v1/radiation/{astronaut_id}` | Cumulative dose, SPE detection, daily history |
| `POST` | `/api/v1/alerts` | Create a clinical alert |
| `GET` | `/api/v1/alerts` | List alerts (filter by `astronaut_id`, `tier`) |
| `GET` | `/api/v1/alerts/critical` | Alerts with tier >= 2 |
| `GET` | `/api/v1/alerts/{astronaut_id}` | Alerts for one astronaut |
| `POST` | `/api/v1/alerts/{alert_id}/acknowledge` | Acknowledge an alert |
| `GET` | `/api/v1/research/sources` | NASA/CSA knowledge base sources |
| `GET` | `/api/v1/research/findings` | Findings, optionally filtered by `domain` |
| `GET` | `/api/v1/research/domain/{domain}` | Evidence for a domain (aliases accepted, e.g. `immune` -> `imm`) |
| `POST` | `/api/v1/research/analyze` | Map an observed anomaly to NASA/CSA evidence |
| `POST` | `/api/v1/research/refresh` | Re-ingest the allowlisted source pages |
| `GET` | `/api/v1/ground-team/contacts` | Ground team directory |
| `GET` | `/api/v1/ground-team/history` | Emergency reports |
| `POST` | `/api/v1/ground-team/emergency-report` | Generate and queue an emergency report |
| `POST` | `/api/v1/ground-team/contact` | Astronaut-initiated transmission |
| `POST` | `/api/v1/ground-team/acknowledge/{report_id}` | Ground acknowledgement |
| `GET` | `/api/v1/ground-team/communication-status` | DSN link state and queue counts |
| `GET` | `/api/v1/ground-team/communication-status/{report_id}` | Per-report transmission attempts |
| `GET` | `/api/v1/devices` | Wearable gateway devices (filter by `astronaut_id`) |
| `POST` | `/api/v1/devices/register` | Register a wearable |
| `POST` | `/api/v1/devices/{device_id}/connect` | Connect a wearable |
| `POST` | `/api/v1/devices/{device_id}/disconnect` | Disconnect a wearable |
| `GET` | `/api/v1/devices/{device_id}/status` | Device live status |
| `POST` | `/api/v1/devices/{device_id}/simulate-packet?mode=nominal` | Emit a simulated sensor burst |
| `POST` | `/api/v1/sync/batch` | Store-and-forward sync (accepts offline-queue and API record shapes) |
| `GET` | `/api/v1/sync/pending` | Queued emergency reports |
| `POST` | `/api/v1/sync/retry` | Retry queued transmissions |

## Configuration

Credentials are read from `backend/.env` (copy `.env.example`). No keys are
hardcoded in the source. `FASTAPI_API_KEY` gates `POST /api/v1/analysis/assess`;
leave it empty to disable that check. `EXTRA_CORS_ORIGINS` is a comma-separated
list of browser origins allowed to call the API in addition to `FRONTEND_ORIGIN`.

---

## Disclaimer
ASTRA is a research and hackathon decision-support prototype. It is not a certified diagnostic medical device. NASA and CSA do not endorse this software.
