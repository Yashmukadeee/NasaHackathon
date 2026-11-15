# ASTRA — Complete API Reference & Endpoint Inventory
## Verified Technical Audit for NASA Hackathon Presentation

**Document Version:** 1.0.0  
**Audit Date:** November 15, 2026  
**Verification Method:** Active HTTP request/response validation against live running services on `localhost:8000` (FastAPI) and `localhost:8080` (Node.js).

---

## 1. FastAPI Analytics & Intelligence Service (`http://127.0.0.1:8000`)

### Endpoint Inventory Table

| # | Endpoint | Method | Purpose | Input / Parameters | Response Schema | Database Tables | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/` | `GET` | Service root probe | None | `{"service": str, "version": str, "status": str}` | None | **Verified (200)** |
| 2 | `/api/v1/status` | `GET` | System health & prototype notice | None | `{"status": "ONLINE", "service": str, "prototype_warning": bool}` | None | **Verified (200)** |
| 3 | `/api/v1/health` | `GET` | Database readiness check | None | `{"status": "healthy", "database": "connected"}` | SQLite connection | **Verified (200)** |
| 4 | `/api/v1/astronauts` | `GET` | List active crew roster | None | `list[{id, name, role, age, blood_type, created_at}]` | `astronauts` | **Verified (200)** |
| 5 | `/api/v1/astronauts/{id}` | `GET` | Get single crew profile | `id` (path, e.g. `ASTRO-1`) | `{id, name, role, age, blood_type, created_at}` | `astronauts` | **Verified (200)** |
| 6 | `/api/v1/telemetry/{id}` | `GET` | Query astronaut historical telemetry | `id` (path), `from`, `to`, `day` (query) | `list[{astronaut_id, mission_day, hr, spo2, ...}]` | `telemetry` + benchmark fallback | **Verified (200)** |
| 7 | `/api/v1/telemetry` | `POST` | Ingest single day telemetry | `TelemetryCreate` JSON | `{"success": bool, "message": str, "id": int}` | `telemetry` | **Verified (200)** |
| 8 | `/api/v1/telemetry/batch` | `POST` | Batch synchronize telemetry | `{"records": list[TelemetryCreate]}` | `{"success": bool, "synced_total": int, "created": int, "updated": int}` | `telemetry` | **Verified (200)** |
| 9 | `/api/v1/analysis/{id}` | `GET` | Execute health analytics engine | `id` (path), `day` (query: 1-180), `include_summary` | Full clinical analysis object (z-scores, EWMA, rules, tier) | `telemetry` + `mission.json` | **Verified (200)** |
| 10 | `/api/v1/analysis/{id}/forecast` | `GET` | Linear projection & risk forecast | `id` (path), `day` (query) | `{linear_forecast, 7_day_metric_trajectories}` | `telemetry` + `mission.json` | **Verified (200)** |
| 11 | `/api/v1/analysis/{id}/history` | `GET` | Multi-day health tier trajectory | `id` (path), `from_day`, `to_day` | `list[{day, tier, status, worst_domain, cum_dose, spe_active}]` | `telemetry` + `mission.json` | **Verified (200)** |
| 12 | `/api/v1/radiation/{id}` | `GET` | Radiation exposure & CSA context | `id` (path), `day` (query) | `{current_dose, cumulative_dose, status, csa_context, csa_instruments}` | `telemetry` | **Verified (200)** |
| 13 | `/api/v1/research/sources` | `GET` | List 5 NASA/CSA research sources | None | `{"sources": list[{agency, title, url, status}], "disclaimer": str}` | `research_sources` | **Verified (200)** |
| 14 | `/api/v1/research/findings` | `GET` | Query research findings by domain | `domain` (query: optional `imm`, `car`, `msk`, `beh`, `env`, `rad`) | `list[ResearchFindingSchema]` | `research_findings` | **Verified (200)** |
| 15 | `/api/v1/research/domain/{domain}` | `GET` | Get domain findings + attribution | `domain` (path), `tier` (query) | `{domain, hazard, findings, summary, source_attribution}` | `research_findings` | **Verified (200)** |
| 16 | `/api/v1/research/refresh` | `POST` | Ingest/refresh allowlisted URLs | None | `{"success": bool, "results": list[{url, status}]}` | `research_sources` | **Verified (200)** |
| 17 | `/api/v1/alerts` | `GET` | List recorded clinical alerts | `astronaut_id`, `tier` (query) | `list[{id, astronaut_id, mission_day, tier, domain, message}]` | `alerts` | **Verified (200)** |
| 18 | `/api/v1/alerts/critical` | `GET` | List Tier 2 & Tier 3 alerts | None | `list[{id, astronaut_id, mission_day, tier, domain, message}]` | `alerts` | **Verified (200)** |
| 19 | `/api/v1/alerts` | `POST` | Record clinical alert & audit entry | `AlertCreate` JSON | `{"success": bool, "alert_id": int, "tier": int}` | `alerts`, `audit_log` | **Verified (200)** |
| 20 | `/api/v1/alerts/{id}/acknowledge` | `POST` | Astronaut alert acknowledgement | `id` (path) | `{"success": bool, "alert_id": int, "acknowledged_at": str}` | `alerts`, `audit_log` | **Verified (200)** |
| 21 | `/api/v1/ground-team/contacts` | `GET` | Ground medical flight surgeons | None | `list[{id, role, name, contact_info, is_configured}]` | `ground_contacts` | **Verified (200)** |
| 22 | `/api/v1/ground-team/emergency-report` | `POST` | Generate & queue emergency report | `EmergencyReportCreate` JSON | `{success, report_id, communication_status, human_readable}` | `emergency_reports`, `audit_log` | **Verified (200)** |
| 23 | `/api/v1/ground-team/contact` | `POST` | Transmit report to ground console | `ContactGroundRequest` JSON | `{success, status, message, report_id}` | `emergency_reports`, `comm_history` | **Verified (200)** |
| 24 | `/api/v1/ground-team/communication-status/{id}` | `GET` | Track report downlink attempts | `id` (path) | `{report_id, status, queued_at, transmitted_at, attempts}` | `emergency_reports`, `comm_history` | **Verified (200)** |
| 25 | `/api/v1/ground-team/history` | `GET` | List emergency report history | None | `list[{id, astronaut_id, mission_day, tier, communication_status}]` | `emergency_reports` | **Verified (200)** |
| 26 | `/api/v1/ground-team/acknowledge/{id}` | `POST` | Ground return acknowledgement | `id` (path) | `{success, status, acknowledged_at, ack_text}` | `emergency_reports`, `comm_history` | **Verified (200)** |
| 27 | `/api/v1/mission/overview` | `GET` | Mission parameters & crew overview | None | `{mission_name, duration_days, crew_count, crew}` | Benchmark mission metadata | **Verified (200)** |

---

## 2. Node.js Edge Bridge Service (`http://127.0.0.1:8080`)

| # | Endpoint | Method | Purpose | Input / Parameters | Response Schema | Status |
|---|---|---|---|---|---|---|
| 1 | `/api/v1/status` | `GET` | Node server bridge heartbeat | None | `{"success": true, "service": str, "status": "ONLINE"}` | **Verified (200)** |
| 2 | `/api/v1/telemetry` | `GET` | Stream benchmark 180-day series | `astronaut_id`, `from`, `to` | `list[{day, hr, spo2, ...}]` | **Verified (200)** |
| 3 | `/api/v1/checkin` | `POST` | Ingest daily subjective log | `{astronaut_id, day, mood, stress, fatigue, sleep, symptoms, notes}` | `{"success": true, "record": {...}}` | **Verified (201)** |
| 4 | `/api/v1/alerts` | `GET` | Local memory alert store | `astronaut_id`, `day` | `list[{id, astronaut_id, day, tier, domain, message}]` | **Verified (200)** |
| 5 | `/api/v1/sync/batch` | `POST` | Edge offline sync queue drain | `{astronaut_id, records: list[...]}` | `{"success": true, "processed_count": int}` | **Verified (200)** |
| 6 | `/*` (Static Files) | `GET` | Serve PWA assets (HTML, CSS, JS, SVG) | Path to file | File stream with correct MIME types | **Verified (200)** |

---

## 3. Sample Live Request & Response Payloads

### A. Health Analysis (`GET /api/v1/analysis/ASTRO-1?day=45`)
```json
{
  "day": 45,
  "adapting": false,
  "domains": {
    "imm": {
      "status": 0,
      "score": 0.32,
      "confidence": 1.0,
      "rule": null,
      "indicators": [
        {"key": "temp", "name": "Resting temperature", "value": 36.65, "baseline": 36.62, "drift": 0.32, "level": 0},
        {"key": "fat", "name": "Fatigue", "value": 2.1, "baseline": 2.05, "drift": 0.11, "level": 0}
      ]
    },
    "car": { "status": 0, "score": 0.28, "confidence": 1.0, "rule": null, "indicators": [...] },
    "msk": { "status": 0, "score": 0.15, "confidence": 1.0, "rule": null, "indicators": [...] },
    "beh": { "status": 0, "score": 0.41, "confidence": 1.0, "rule": null, "indicators": [...] },
    "env": { "status": 0, "score": 0.05, "confidence": 1.0, "rule": null, "indicators": [...] },
    "rad": { "status": 0, "score": 0.22, "confidence": 1.0, "rule": null, "indicators": [...] }
  },
  "contributors": [],
  "forecast": null,
  "overall": {
    "status": 0,
    "tier": 0,
    "worstDomain": "beh"
  },
  "spe": null,
  "cumDose": 18.4,
  "prototype_disclaimer": "Prototype decision-support analysis. Not certified clinical medical diagnostic."
}
```

### B. Emergency Escalation Dispatch (`POST /api/v1/ground-team/emergency-report`)
```json
{
  "success": true,
  "report_id": 3,
  "astronaut_id": "ASTRO-1",
  "mission_day": 45,
  "tier": 0,
  "communication_status": "queued",
  "queued_at": "2026-11-15T06:40:28.715751",
  "human_readable": "=== ASTRA EMERGENCY MEDICAL ESCALATION REPORT ===\nReport ID: EMERGENCY-D45-ASTRO-1\nTimestamp: 2026-11-15T06:40:28.715751+00:00\nAstronaut: ASTRO-1 | Mission Day: 45\nSeverity: TIER 0 - NOMINAL\nPrimary Domain: Immune System (imm)\n\nASSESSMENT:\nVitals nominal for ASTRO-1.\n\nIMMEDIATE ACTIONS REQUIRED:\n[1] Hydrate and log core temperature every 4 hours.\n[2] Maintain physical isolation from crewmembers if respiratory symptoms occur.\n[3] Prepare CMO diagnostic kit for viral/bacterial antigen panel.\n\nGROUND TELEMETRY TRANSMISSION STATUS: QUEUED FOR DOWNLINK\n===============================================\n",
  "prototype_warning": "Report saved to local queue. Ready for crew-authorized downlink transmission."
}
```
