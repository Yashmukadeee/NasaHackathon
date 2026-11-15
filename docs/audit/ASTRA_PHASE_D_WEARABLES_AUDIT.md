# ASTRA – PHASE D: REAL-TIME WEARABLE INTEGRATION & SUPABASE DATABASE AUDIT

**Author:** ASTRA Core Engineering Team  
**System:** ASTRA – Astronaut Health Intelligence System (NASA Space Apps Challenge)  
**Status:** IMPLEMENTED, TESTED, AND VERIFIED (100% Passing Tests)  
**Date:** November 15, 2026  

---

## 1. Executive Summary

Phase D elevates ASTRA from an offline synthetic mission intelligence tool to a dual-mode, real-time physiological telemetry platform. The architecture integrates physical and emulated astronaut wearables, a standardized hardware gateway, a 14-step Clinical Decision Support System (CDSS) pipeline, and a synchronized Supabase PostgreSQL cloud backend.

### Key Capabilities Introduced
1. **Astronaut Wearable Hardware Gateway (`backend/app/devices/`):**
   - Device abstraction supporting Bluetooth Low Energy (GATT Heart Rate, Pulse Oximeter, Health Thermometer), Wi-Fi/LAN HTTP Gateways, and labeled flight test simulators.
   - Transparent labeling separating physical hardware from emulated test modes (`nominal`, `fever`, `hypoxia`, `arrhythmia`).
2. **Telemetry Normalizer & Biological Bounds Guard (`backend/app/devices/normalizer.py`):**
   - Dynamic canonical unit standardization (°F $\rightarrow$ °C, kPa $\rightarrow$ mmHg, seconds $\rightarrow$ hours).
   - Biological limit validation enforcing human plausible ranges (e.g. Heart Rate: 30–220 bpm, Body Temp: 34.0–42.5 °C).
   - ISO-8601 UTC timestamp and provenance tracking.
3. **14-Step Incremental Analysis Pipeline (`backend/app/services/realtime_pipeline.py`):**
   - Sub-5ms incremental Z-score and EWMA evaluation per incoming packet against personal astronaut baselines.
   - Automated cross-domain synergy analysis and NASA HRP / CSA research citation mapping.
   - Dual-dispatch alert engine (Supabase Realtime Cloud + Local SQLite Fallback).
4. **Supabase PostgreSQL Database Architecture (`supabase/migrations/`):**
   - 12 production-grade relational tables with UUID primary keys, Row Level Security (RLS) policies, and foreign key cascades.
   - Fallback offline buffering guaranteeing zero data loss during deep space Loss of Signal (LOS).
5. **Modern Frontend Hardware Workstation (`web/index.html`, `web/app.js`):**
   - Dedicated "Wearable Gateway" tab with paired hardware telemetry cards, connection toggles, signal quality meters, battery monitors, real-time testing controls, and a live hexadecimal/stream terminal.

---

## 2. Supabase PostgreSQL Schema Overview

The database is deployed on project `cboiwmazdwworsyviimc` with 12 synchronized tables:

| Table | Primary Key | Description |
|---|---|---|
| `astronauts` | `id` (VARCHAR) | Crew profiles, blood types, baselines, roles, active status |
| `wearable_devices` | `device_id` (VARCHAR) | Hardware registry, MAC addresses, protocols, assigned crew |
| `device_sessions` | `id` (UUID) | Pairing sessions, disconnect timestamps, battery tracking |
| `telemetry_readings`| `id` (UUID) | Individual physiological readings, units, signal quality, provenance |
| `health_baselines` | `id` (UUID) | Individualized 30-day running means and standard deviations |
| `health_analyses` | `id` (UUID) | Real-time incremental and multi-day health engine inferences |
| `health_alerts` | `id` (UUID) | Tier 1 (Attention), Tier 2 (Warning), Tier 3 (Critical) alerts |
| `daily_checkins` | `id` (UUID) | Subjective symptom scores, sleep logs, hydration, fatigue |
| `research_findings` | `id` (UUID) | Official NASA HRP, NSBRI, and CSA space medicine evidence |
| `emergency_reports` | `id` (UUID) | Flight surgeon escalation dossiers with priority tagging |
| `communication_logs`| `id` (UUID) | Transmission logs with simulated light-time delay timestamps |
| `device_status` | `device_id` (VARCHAR) | Real-time connection states (`CONNECTED`, `DISCONNECTED`, `DATA_STALE`) |

---

## 3. The 14-Step Real-Time Health Analysis Pipeline

Each sensor packet follows an aerospace telemetry pipeline:

```mermaid
flowchart TD
    A[Step 1: Wearable Packet] --> B[Step 2: Authenticate Device]
    B --> C[Step 3: Validate Biological Bounds]
    C --> D[Step 4: Normalize Canonical Units]
    D --> E[Step 5: Store in Supabase / Local Buffer]
    E --> F[Step 6: Retrieve Personal Baseline]
    F --> G[Step 7: Compute Directional Z-Score]
    G --> H[Step 8: Compute EWMA Drift]
    H --> I[Step 9: Cross-Domain Synergy Analysis]
    I --> J[Step 10: Query NASA/CSA Research Evidence]
    J --> K[Step 11: Generate Tier 0-3 Classification]
    K --> L[Step 12: Generate Clinical Action Recommendation]
    L --> M[Step 13: Dispatch Alerts to Cloud & Local Store]
    M --> N[Step 14: Emit Live UI Stream Packet]
```

---

## 4. Test Verification Suite Summary

### A. Python FastAPI Backend Tests (`backend/app/tests/`)
- **Total Backend Tests:** 21
- **Passed:** 21 (100%)
- **Failed:** 0
- **Duration:** 13.45s

```
backend/app/tests/test_analysis.py::test_prepare_and_analyze_day_10 PASSED
backend/app/tests/test_analysis.py::test_ground_summary_generation PASSED
backend/app/tests/test_analysis.py::test_infection_pattern_synergy PASSED
backend/app/tests/test_api.py::test_root_endpoint PASSED
backend/app/tests/test_api.py::test_health_and_status_endpoints PASSED
backend/app/tests/test_api.py::test_astronauts_endpoints PASSED
backend/app/tests/test_api.py::test_telemetry_get_endpoint PASSED
backend/app/tests/test_api.py::test_analysis_endpoint PASSED
backend/app/tests/test_api.py::test_ground_team_contacts_endpoint PASSED
backend/app/tests/test_api.py::test_emergency_report_creation_and_status PASSED
backend/app/tests/test_devices.py::test_supabase_status_endpoint PASSED
backend/app/tests/test_devices.py::test_device_registry_and_lifecycle PASSED
backend/app/tests/test_devices.py::test_simulate_packet_endpoint PASSED
backend/app/tests/test_devices.py::test_telemetry_ingest_and_live_read PASSED
backend/app/tests/test_devices.py::test_telemetry_normalizer_unit_conversions_and_bounds PASSED
backend/app/tests/test_devices.py::test_realtime_pipeline_analysis[asyncio] PASSED
backend/app/tests/test_escalation.py::test_escalation_classification PASSED
backend/app/tests/test_escalation.py::test_emergency_report_generation PASSED
backend/app/tests/test_research.py::test_research_sources_list PASSED
backend/app/tests/test_research.py::test_evidence_mapping_for_domains PASSED
backend/app/tests/test_research.py::test_csa_radiation_instruments_attribution PASSED
```

### B. Node.js Telemetry Engine Tests (`tests/*.test.mjs`)
- **Total Tests:** 14
- **Passed:** 14 (100%)
- **Failed:** 0
- **Duration:** 162ms

### C. Clinical Detection Benchmark (`eval/evaluate.mjs`)
- **False Alarms on Healthy Missions:** 0.66 per 30 days
- **Infection Detection Rate:** 20/20 (Median latency: 4 days)
- **CO2 Hypercapnia Detection Rate:** 20/20 (Median latency: 1 day)
- **Bone Loading Decline Detection Rate:** 20/20 (Median latency: 3 days)
- **Solar Particle Event (SPE) Detection Rate:** 20/20 (Latency: 0 days / instantaneous)
- **Mood / Confinement Decline Detection Rate:** 19/20 (Median latency: 16 days)

---

## 5. Security & Aerospace Offline Guarantee

1. **Dual Token Separation:**
   - The Supabase Service Role Key is strictly retained on the backend and NEVER exposed to frontend JavaScript or client-side requests.
   - The frontend communicates via authenticated local reverse proxy or anonymous client key (`sb_publishable_...`).
2. **Deep Space Resilience:**
   - When Earth ground link / internet drops (simulating Martian LOS), all incoming wearable packets are immediately committed to local SQLite and browser IndexedDB.
   - When connection is restored, records sync seamlessly to Supabase without duplicate key collisions.
