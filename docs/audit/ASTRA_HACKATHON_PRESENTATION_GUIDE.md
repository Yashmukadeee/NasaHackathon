# ASTRA — NASA Hackathon Presentation Guide
## 14-Slide Technical Pitch Deck & Presenter Speaking Scripts

**Event:** NASA Space Apps Challenge  
**Team Project:** ASTRA – Astronaut Health Intelligence System  
**Presentation Time:** 5 to 7 Minutes  

---

### SLIDE 1 — What is ASTRA?
- **Key Points:**
  - Autonomous edge medical intelligence workstation for long-duration spaceflight.
  - Monitors 17 clinical and environmental vital indicators in real-time.
  - Zero-cloud dependency; designed to operate during deep space communication blackouts.
  - Decision-support system grounded directly in published NASA HRP and CSA research.
- **Suggested Visual:** High-resolution screenshot of the ASTRA Flight Deck showing the dark aerospace UI, glowing holographic Digital Twin, and real-time ECG oscilloscope canvas.
- **Technical Explanation:** A dual-server edge architecture combining a zero-dependency Node.js bridge on port 8080 with a Python FastAPI computational engine on port 8000, backed by native client IndexedDB and onboard async SQLite.
- **Presenter Speaking Script:**  
  *"Good morning judges. On a three-year mission to Mars, an astronaut cannot dial 911 or stream high-bandwidth telemedicine to Houston. Radio signals take up to 22 minutes each way. This is ASTRA — the Astronaut Health Intelligence System. It is an autonomous, aerospace-grade medical monitoring workstation that tracks crew biometrics, detects insidious physiological drift, and provides explainable, research-backed clinical decision support directly to the crew without needing Earth."*

---

### SLIDE 2 — The Spaceflight Health Problem
- **Key Points:**
  - Microgravity causes severe cephalad fluid shifts, baroreceptor reset, and cardiovascular deconditioning.
  - 1% to 1.5% bone mineral density loss per month in weight-bearing bones.
  - Galactic Cosmic Radiation (GCR) and Solar Particle Events (SPE) damage central nervous and immune systems.
  - Closed-cabin $\text{CO}_2$ buildup causes cognitive deceleration easily confused with illness.
- **Suggested Visual:** Diagram of the 5 Hazards of Human Spaceflight (NASA HRP framework).
- **Technical Explanation:** Long-duration spaceflight couples physiological degradation across multiple systems. A fever is not just an infection; paired with microgravity and radiation, it accelerates immune collapse.
- **Presenter Speaking Script:**  
  *"Space is inherently hostile to human biology. Without gravity, bones lose up to 1.5% of their mineral density every month. Cosmic radiation damages DNA, and cabin carbon dioxide can mimic severe viral fatigue. In isolation, subtle deterioration can quietly turn fatal if not detected early."*

---

### SLIDE 3 — ASTRA System Architecture
- **Key Points:**
  - Dual-engine architecture: Node.js static PWA edge server + Python FastAPI analytics engine.
  - Tiered data persistence: Browser IndexedDB (instantaneous UI responsiveness) + SQLite (`backend/astra.db`).
  - Asynchronous background tasking with zero blocking of vital sign sweeps.
  - 100% offline-first capability with store-and-forward telemetry queueing.
- **Suggested Visual:** The Dual-Server Architecture Diagram showing browser client, Node.js port 8080, and FastAPI port 8000.
- **Technical Explanation:** Decoupling the client-side presentation and IndexedDB store from the heavy mathematical backend ensures the flight deck never drops an ECG frame, even while running complex regression models.
- **Presenter Speaking Script:**  
  *"To solve the latency and blackout problem, we architected ASTRA with a dual-server topology. The flight deck runs in the browser, caching all telemetry locally in IndexedDB. In the background, an async Python FastAPI backend executes statistical trend analysis and manages communications. If Earth connectivity drops completely, ASTRA continues operating with zero loss of functionality."*

---

### SLIDE 4 — Frontend & Anatomical Digital Twin
- **Key Points:**
  - Central Holographic Anatomical Twin rendered in responsive SVG vector graphics.
  - Organ-layer toggling: Skeletal, Cardiopulmonary, Organ Mapping, and Vascular layers.
  - Interactive clinical hotspots with live biometric tooltip telemetry.
  - Real-time 60fps simulated ECG oscilloscope canvas running Lead II cardiac sweeps.
- **Suggested Visual:** Close-up of the cyan holographic human body wireframe with pulsating heart and lungs.
- **Technical Explanation:** Developed using pure vanilla ES modules and SVG styling to eliminate heavy third-party bundle bloat, ensuring instantaneous loading and sub-millisecond interaction latency.
- **Presenter Speaking Script:**  
  *"At the heart of the Flight Deck is our signature feature: the Holographic Anatomical Digital Twin. Inspired by aerospace medical workstations, crew members can toggle between skeletal, cardiopulmonary, and vascular layers. Clicking any organ instantly surfaces personal baseline comparisons, drift scores, and active clinical alarms."*

---

### SLIDE 5 — FastAPI Backend Architecture
- **Key Points:**
  - Built with Python 3.11, FastAPI, Async SQLAlchemy 2.0, and aiosqlite.
  - 18 versioned REST API endpoints (`/api/v1/...`).
  - Automated Swagger UI (`/docs`) and ReDoc (`/redoc`) documentation.
  - Multi-astronaut relational data model with compound key deduplication.
- **Suggested Visual:** FastAPI Swagger UI screenshot showing endpoints grouped by `analysis`, `telemetry`, `radiation`, `research`, and `ground-team`.
- **Technical Explanation:** Async database sessions prevent thread pool exhaustion during burst telemetry syncs. Pydantic v2 schemas strictly validate every physiological metric against human biological bounds.
- **Presenter Speaking Script:**  
  *"Our backend is built on modern Python FastAPI with async SQLAlchemy. It manages multi-astronaut clinical records, runs our statistical engines, and provides 18 verified API endpoints with complete Pydantic data validation."*

---

### SLIDE 6 — NASA & CSA Research Intelligence
- **Key Points:**
  - Incorporates findings from 5 official NASA HRP and CSA research publications.
  - Grounded literature attribution linked to active clinical alerts.
  - Highlights CSA space radiation hardware: EVARM, MOSFET dosimeters, CANS, and Radi-N.
  - Strict input allowlisting and sanitization prevent malicious HTML payload execution.
- **Suggested Visual:** Educational Research Dialog showing NASA HRP citations and Canadian Space Agency dosimeter references.
- **Technical Explanation:** Findings are indexed across relational tables (`research_sources`, `research_findings`). When a physiological domain triggers an alert, the engine automatically retrieves and cites the relevant research finding.
- **Presenter Speaking Script:**  
  *"ASTRA doesn't just display numbers; it provides explainable evidence. We ingested research from five official NASA Human Research Program and Canadian Space Agency publications. For example, when radiation spikes, ASTRA cites CSA's EVARM spacewalk dosimetry studies and instructs the crew on storm shelter protocols."*

---

### SLIDE 7 — Health Analytics & Anomaly Detection
- **Key Points:**
  - Deterministic statistical methods: Individual baseline mean, SD floor, Directional Z-scores, and EWMA drift ($\lambda = 0.3$).
  - 7-day microgravity adaptation window suppresses early adaptation false alarms.
  - 2-day persistence filter prevents single-day transient spikes from triggering alarms.
  - Cross-domain synergy rules detect complex multi-parameter clinical syndromes.
- **Suggested Visual:** Diagram comparing single-point noisy vitals vs EWMA drift smoothing with Amber/Red thresholds.
- **Technical Explanation:** We deliberately avoided black-box machine learning models in favor of auditable, transparent statistical signal processing, eliminating hallucinations and ensuring explainability.
- **Presenter Speaking Script:**  
  *"Why did we choose statistical processing over machine learning? Because in space medicine, explainability is life-or-death. A black-box AI cannot tell an astronaut why it flagged a heart failure alert. ASTRA calculates personal baselines from Days 8 to 30, uses EWMA smoothing to eliminate sensor noise, and applies a strict two-day persistence filter."*

---

### SLIDE 8 — Predictive Health Monitoring
- **Key Points:**
  - 5-day drift trajectory slope modeling.
  - Linear horizon forecasting estimates days until a metric reaches Watch/Act thresholds.
  - Anticipates health deterioration up to 10 days in advance.
  - Evaluated across 40 mission datasets (800 evaluation cycles).
- **Suggested Visual:** Spline graph showing a metric rising with a dashed projection line intersecting the Amber threshold line.
- **Technical Explanation:** By calculating the rate of change of the smoothed EWMA drift, ASTRA projects future physiological trajectory without making ungrounded assumptions.
- **Presenter Speaking Script:**  
  *"ASTRA doesn't just react to emergencies; it predicts them. Our trajectory engine calculates the five-day slope of biometric drift. If an astronaut's exercise minutes are decreasing while grip strength is slipping, ASTRA calculates the exact number of days before clinical Watch status will be breached, allowing early intervention before irreversible muscle loss occurs."*

---

### SLIDE 9 — Emergency Ground Team Escalation
- **Key Points:**
  - Protocol-driven Tier 0 (Nominal) to Tier 3 (Critical Event) escalation.
  - Autonomous generation of human-readable and JSON emergency medical briefs.
  - Human-in-the-loop: Astronaut explicitly authorizes ground transmission via the UI.
  - Downlink attempt logging and ground flight surgeon acknowledgement tracking.
- **Suggested Visual:** Screenshot of the Emergency Escalation Modal Dialog with the pulsing red header and the `TRANSMIT TO GROUND CONSOLE` button.
- **Technical Explanation:** The system packages vitals, contributing synergy patterns, and recommended clinical actions into an atomic report that survives disconnections.
- **Presenter Speaking Script:**  
  *"When a Tier 3 critical event occurs—such as an active solar flare or a severe infection triad—ASTRA generates an Emergency Medical Report. Crucially, the system keeps the human in the loop: the astronaut reviews the clinical brief and confirms transmission to the Ground Flight Surgeon console."*

---

### SLIDE 10 — Offline-First Deep Space Capability
- **Key Points:**
  - Full local operational continuity during communication blackouts (LOS).
  - Browser IndexedDB stores telemetry, check-ins, and alerts independently.
  - Store-and-forward queue automatically synchronizes data when links restore.
  - Truthful status indicators: reports in queue clearly display `LOCAL QUEUED`.
- **Suggested Visual:** Flowchart showing offline data queuing in IndexedDB, then flushing to the backend upon reconnection.
- **Technical Explanation:** State transitions from `queued` to `transmitted` only upon verified HTTP receipt, preventing misleading representations of ground communication status.
- **Presenter Speaking Script:**  
  *"During a solar conjunction blackout, ASTRA never stalls. All daily check-ins and emergency alerts are preserved in local persistent storage. When communications restore, our store-and-forward engine automatically transmits pending reports to Earth. ASTRA never tells an astronaut that Earth received a message unless an acknowledgement has physically returned."*

---

### SLIDE 11 — Technology Stack & APIs
- **Key Points:**
  - **Frontend:** Vanilla HTML5, CSS3 Aerospace Design System, ES Modules, SVG, Canvas 2D, IndexedDB.
  - **Edge Server:** Node.js v25 native HTTP server (Zero NPM runtime dependencies).
  - **Analytics Backend:** Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0, aiosqlite, NumPy, SciPy, Pandas.
  - **Testing:** Node.js native test runner + Pytest.
- **Suggested Visual:** Tech stack icon grid showcasing Python, FastAPI, SQLite, Node.js, and HTML5/Canvas.
- **Technical Explanation:** Lightweight, auditable, and resilient tech stack optimized for long-duration operation with zero external package vulnerabilities.
- **Presenter Speaking Script:**  
  *"Our architecture is built on rock-solid technologies: a zero-dependency Node.js edge server, a Python FastAPI computation engine, and native browser APIs. No bloated third-party frameworks, no external cloud dependencies, and zero single points of failure."*

---

### SLIDE 12 — Testing & Benchmark Results
- **Key Points:**
  - **15 / 15 Pytest tests passing** (100% backend pass rate).
  - **14 / 14 Node.js unit tests passing** (100% edge pass rate).
  - **False Alarm Rate:** **0.66 per 30 days** on healthy missions (Target: $\le 1.2$).
  - **Detection Accuracy:** 20/20 infection, 20/20 $\text{CO}_2$, 20/20 SPE, 20/20 bone loss.
- **Suggested Visual:** Benchmark table summarizing detection latency, detection accuracy, and false alarm metrics.
- **Technical Explanation:** Evaluated across 40 distinct 180-day mission datasets containing synthetic biological noise and complex clinical anomalies.
- **Presenter Speaking Script:**  
  *"We rigorously verified ASTRA across 40 mission datasets. The results speak for themselves: 100% detection rate across acute infection, carbon dioxide spikes, solar particle events, and bone loading deficits. Most importantly, our false alarm rate is just 0.66 per 30 days—well below our aerospace threshold target of 1.2."*

---

### SLIDE 13 — Current Limitations
- **Key Points:**
  - Prototype clinical thresholds; requires flight surgeon panel review before flight certification.
  - Telemetry is fed from simulated benchmark datasets (`mission.json`), not live spacecraft telemetry buses.
  - Ground communication simulates DSN downlink rather than connecting to real Deep Space Network radio transmitters.
  - Currently evaluates single crew members with comparative ripple, not dynamic whole-crew epidemiological spread models.
- **Suggested Visual:** A clear, honest boundary comparison graphic: "Flight-Ready Architecture vs Prototype Simulation".
- **Technical Explanation:** Adhering strictly to hackathon integrity, we distinguish working software architecture from operational aerospace hardware integration.
- **Presenter Speaking Script:**  
  *"We believe in complete technical honesty. ASTRA is a high-fidelity prototype. Our clinical thresholds are experimental values, our telemetry is generated from 180-day simulated datasets, and ground communication uses an HTTP gateway bridge rather than physical Deep Space Network radio hardware. However, the architecture is fully production-ready."*

---

### SLIDE 14 — Future Scope
- **Key Points:**
  - Integration with NASA CCSDS (Consultative Committee for Space Data Systems) telemetry packet protocols.
  - Multi-crew epidemiological transmission modeling for viral pathogen tracking in enclosed habitats.
  - Wearable sensor Bluetooth Low Energy (BLE) direct integration (smart garments, smart rings).
  - Autonomous robotic medical kit dispensing integration.
- **Suggested Visual:** Roadmap graphic highlighting Lunar Artemis Basecamp (2028) and Mars Transit Vehicle (2035).
- **Technical Explanation:** ASTRA’s modular REST and database design allows plugging in real-time telemetry decoders with zero changes to the underlying analytical engine.
- **Presenter Speaking Script:**  
  *"Looking forward, ASTRA is architected to integrate directly with NASA’s CCSDS spacecraft telemetry bus and wearable biosensors. As humanity prepares for Artemis lunar bases and the journey to Mars, ASTRA will serve as the indispensable medical guardian for our astronauts. Thank you, and we welcome your questions."*
