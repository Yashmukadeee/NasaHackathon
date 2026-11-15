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

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service root and status |
| `GET` | `/api/v1/status` | Backend health and prototype notice |
| `GET` | `/api/v1/astronauts` | Crew roster and profiles |
| `GET` | `/api/v1/telemetry/{id}` | Telemetry history (17 clinical metrics) |
| `POST` | `/api/v1/telemetry` | Log single daily telemetry entry |
| `POST` | `/api/v1/telemetry/batch` | Batch sync offline telemetry records |
| `GET` | `/api/v1/analysis/{id}` | Real-time health analysis, z-scores, EWMA drift |
| `GET` | `/api/v1/analysis/{id}/forecast` | 7-day risk trajectory projection |
| `GET` | `/api/v1/research/sources` | 5 NASA/CSA research sources with attribution |
| `GET` | `/api/v1/research/domain/{domain}` | Research findings for specific clinical domain |
| `GET` | `/api/v1/radiation/{id}` | Cumulative radiation & CSA instrument telemetry |
| `POST` | `/api/v1/alerts` | Create new clinical alert |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Astronaut acknowledge alert |
| `GET` | `/api/v1/ground-team/contacts` | Medical ground team directory |
| `POST` | `/api/v1/ground-team/emergency-report` | Generate and queue emergency medical report |
| `POST` | `/api/v1/ground-team/contact` | Astronaut-initiated transmission to ground team |
| `GET` | `/api/v1/ground-team/communication-status/{id}` | Track transmission status and downlink attempts |

---

## Disclaimer
ASTRA is a research and hackathon decision-support prototype. It is not a certified diagnostic medical device. NASA and CSA do not endorse this software.
