# ASTRA — Complete System Architecture Specification
## Deep Space Astronaut Health Intelligence System

**Document Version:** 1.0.0  
**Project:** ASTRA – Astronaut Health Intelligence System (NASA Space Apps Challenge)  
**Classification:** Technical Architecture Specification & Presentation Audit  
**Date:** November 15, 2026  

---

## 1. Architectural Philosophy & Dual-Server Topology

ASTRA is architected specifically for autonomous, long-duration human deep space missions (such as Mars Transit and Lunar Surface Sorties). The system operates under extreme operational constraints:
- **Variable Signal Propagation Delays:** 3 to 22 minutes one-way radio latency (LOS: Loss of Signal).
- **Communication Blackouts:** Solar conjunctions or planetary occultations resulting in multi-day zero-downlink periods.
- **Resource Constraints:** Zero dependency on remote cloud infrastructure; all computational analysis occurs entirely at the edge.

To balance instantaneous bedside responsiveness with deep computational intelligence, ASTRA implements a **Dual-Server Topology**:

```mermaid
graph TB
    subgraph Browser ["ASTRA Flight Deck (Client / Astronaut Interface)"]
        UI["Aerospace Flight Deck UI<br/>(11 Subsystem Views / Web Components)"]
        DigitalTwin["Holographic Anatomical Twin<br/>(Interactive SVG / Layer Filter)"]
        Oscilloscope["Real-Time ECG Canvas<br/>(60fps Oscilloscope Sweep)"]
        IDB[("Client IndexedDB<br/>astronauts, telemetry, alerts,<br/>checkins, sync_queue")]
        SyncMgr["Sync & Downlink Manager<br/>(Store-and-Forward Engine)"]
    end

    subgraph NodeServer ["Node.js Edge Bridge (:8080)"]
        StaticServe["Zero-Dependency Static Asset Server<br/>(ES Modules, PWA Service Worker)"]
        EdgeREST["REST Compatibility Endpoints<br/>(/api/v1/telemetry, /api/v1/checkin, /api/v1/sync/batch)"]
        BenchMission[("Immutable Benchmark<br/>web/data/mission.json")]
    end

    subgraph FastAPIServer ["Python FastAPI Advanced Analytics Engine (:8000)"]
        APIRouter["Versioned API Gateways (/api/v1)"]
        HealthEngine["Deterministic Analytics Engine<br/>(Z-Score, EWMA Drift, Persistence)"]
        RiskPredictor["Predictive Trajectory Model<br/>(Linear Regression, Horizon Forecasting)"]
        ResearchEngine["NASA / CSA Research Knowledge Base<br/>(5 Allowlisted Sources, Evidence Mapping)"]
        EscalationEngine["Multi-Tier Escalation Engine<br/>(Tier 0 Nominal → Tier 3 Critical)"]
        GroundComms["Ground Communication Service<br/>(Offline Queue, Downlink Tracker)"]
        SQLiteDB[("Onboard Relational DB<br/>backend/astra.db<br/>Async SQLAlchemy 2.0 / aiosqlite")]
    end

    subgraph EarthGround ["Earth Ground Segment (Simulated)"]
        FlightSurgeon["Ground Flight Surgeon Console"]
        DSN["Deep Space Network Uplink/Downlink"]
    end

    UI --> IDB
    UI --> SyncMgr
    SyncMgr -->|Port 8080 HTTP| EdgeREST
    SyncMgr -->|Port 8000 HTTP| APIRouter
    StaticServe --> UI
    EdgeREST --> BenchMission

    APIRouter --> HealthEngine
    APIRouter --> RiskPredictor
    APIRouter --> ResearchEngine
    APIRouter --> EscalationEngine
    APIRouter --> GroundComms

    HealthEngine --> SQLiteDB
    EscalationEngine --> SQLiteDB
    GroundComms --> SQLiteDB
    ResearchEngine --> SQLiteDB

    GroundComms -.->|Simulated High-Latency Gateway| DSN
    DSN -.-> FlightSurgeon
```

---

## 2. Telemetry Processing & Analytical Pipeline

Information flows from raw biometric measurement through multi-stage statistical filtering to clinical action:

```mermaid
sequenceDiagram
    autonumber
    participant Bio as Astronaut / Sensors
    participant Client as Flight Deck UI (Browser)
    participant Engine as Health Analytics Engine
    participant DB as Local Persistent Store (IndexedDB / SQLite)
    participant Esc as Escalation & Rules Engine
    participant Ground as Ground Medical Queue

    Bio->>Client: Daily Telemetry Logged (17 Clinical Metrics)
    Client->>DB: Commit to Local Storage (Zero Latency)
    Client->>Engine: Trigger prepare(series) & analyze(ctx, day)
    
    rect rgb(20, 35, 55)
        Note over Engine: Baseline Calibration (Days 8-30 Mean & SD)
        Note over Engine: Directional Z-Score Calculation ([-6, +6])
        Note over Engine: EWMA Drift Integration (Lambda = 0.3)
        Note over Engine: Persistence Filter (2 Consecutive Days)
    end
    
    Engine->>Esc: Evaluate Synergy Rules (Infection, CO2, SPE, Bone Loading)
    
    alt Status == Normal (0) or Watch (1)
        Esc->>Client: Render Nominal / Attention Visual Cues (Tier 0 or 1)
    else Status == Act (2) or Cross-Domain Synergy
        Esc->>DB: Log High-Priority / Critical Alert (Tier 2 or 3)
        Esc->>Client: Trigger Emergency Visual Overlay & Chime
        Client->>Ground: Stage Emergency Escalation Report (Status: QUEUED)
        Note over Client: Awaiting Astronaut Authorization to Downlink
    end
```

---

## 3. NASA & CSA Research Integration Architecture

ASTRA connects real-time telemetry anomalies to official published literature from the NASA Human Research Program (HRP) and the Canadian Space Agency (CSA):

```mermaid
flowchart LR
    subgraph Sources ["5 Approved Allowlisted Sources"]
        S1["NASA HRP Hazards<br/>nasa.gov/hrp/hazards"]
        S2["NASA HRP Risks<br/>nasa.gov/hrp/risks"]
        S3["NASA Ongoing HRP Research<br/>nasa.gov/hrp/ongoing-hrp-research"]
        S4["CSA Radiation Monitoring<br/>asc-csa.gc.ca/eng/news/..."]
        S5["CSA Space Science Experiments<br/>asc-csa.gc.ca/eng/iss/science/..."]
    end

    subgraph Pipeline ["Research Processing Pipeline"]
        Fetch["HTTPX Ingestion Engine<br/>(30s Timeout, Allowlist Enforced)"]
        Parser["BeautifulSoup4 Sanitizer<br/>(DOM Stripping, Safe Text Extraction)"]
        Hasher["SHA-256 Hash Verifier<br/>(Integrity & Change Detection)"]
        Classifier["Domain Evidence Mapper<br/>(imm, msk, car, beh, env, rad)"]
    end

    subgraph Storage ["Research Knowledge Base"]
        KB_Relational[("SQLite Knowledge Store<br/>research_sources<br/>research_findings<br/>research_mappings")]
    end

    subgraph Presentation ["Clinical Decision Support"]
        AlertLink["Alert Context Linking<br/>(e.g. Rad Tier 2 → EVARM/MOSFET Dosimetry)"]
        EduModal["Educational Modal & Ground Export Attribution"]
    end

    Sources --> Fetch
    Fetch --> Parser
    Parser --> Hasher
    Hasher --> Classifier
    Classifier --> KB_Relational
    KB_Relational --> AlertLink
    AlertLink --> EduModal
```

---

## 4. Emergency Escalation & Downlink Workflow

```mermaid
stateDiagram-v2
    [*] --> TelemetryIntake
    TelemetryIntake --> BaselineComparison

    state BaselineComparison {
        [*] --> CheckZScore
        CheckZScore --> EWMA_Smoothing
        EWMA_Smoothing --> PersistenceCheck
    }

    PersistenceCheck --> Tier0_Nominal : Drift < 1.3 SD
    PersistenceCheck --> Tier1_Attention : Sustained Drift >= 1.3 SD
    PersistenceCheck --> Tier2_HighPriority : Sustained Drift >= 2.3 SD
    PersistenceCheck --> Tier3_Critical : Multi-Domain Act OR Infection/SPE Triad

    Tier0_Nominal --> RoutineOperations
    Tier1_Attention --> SelfManagementProtocol
    Tier2_HighPriority --> CMO_ReviewPrompt

    Tier3_Critical --> GenerateReport
    state GenerateReport {
        [*] --> CompileTelemetrySummary
        CompileTelemetrySummary --> CrossReferenceResearch
        CrossReferenceResearch --> FormulateRecommendedActions
        FormulateRecommendedActions --> WriteLocalQueue
    }

    WriteLocalQueue --> AwaitingCrewAuthorization
    AwaitingCrewAuthorization --> DispatchedToGateway : Crew Confirms Downlink
    AwaitingCrewAuthorization --> RetainedInQueue : Crew Postpones

    DispatchedToGateway --> GroundAcknowledged : Ground Return Uplink Received
    DispatchedToGateway --> RetriedInQueue : Link Severed (LOS)
    RetriedInQueue --> DispatchedToGateway : Next Orbital Pass
```

---

## 5. Offline-First Synchronization Architecture

```mermaid
flowchart TD
    subgraph ClientSpace ["Astronaut Tablet / Workstation"]
        Action["Astronaut Action<br/>(Check-in, Alert Ack, Manual Override)"]
        IDB_Queue[("IndexedDB<br/>sync_queue Store")]
        NetDetect{"Network Available?<br/>(FastAPI / Node)"}
        DirectWrite["Local Application State Update<br/>(Zero Block)"]
    end

    subgraph SyncLoop ["Store-and-Forward Engine"]
        Drain["Sync Worker (30s Cycle)"]
        Batch["Compile Batch Payload<br/>(/api/v1/sync/batch)"]
        Dispatch["Atomic HTTP POST"]
    end

    subgraph BackendSpace ["FastAPI / Relational DB"]
        Ingest["Batch Ingestion Endpoint"]
        Dedupe["Compound Key Deduplication<br/>(astronaut_id, mission_day)"]
        Audit["Audit Log Appended<br/>(audit_log Table)"]
    end

    Action --> DirectWrite
    Action --> IDB_Queue
    DirectWrite --> NetDetect
    NetDetect -- No (Blackout) --> IDB_Queue
    NetDetect -- Yes (Online) --> Drain
    IDB_Queue --> Drain
    Drain --> Batch
    Batch --> Dispatch
    Dispatch --> Ingest
    Ingest --> Dedupe
    Dedupe --> Audit
```
