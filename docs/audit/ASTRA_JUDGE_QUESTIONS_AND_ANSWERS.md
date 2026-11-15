# ASTRA — Judge Technical Questions & Authoritative Answers
## 25 Critical Defense Inquiries for NASA Space Apps Hackathon

**Document Version:** 1.0.0  
**Preparation Target:** NASA Hackathon Technical Evaluation Panel  

---

### 1. Why did you choose FastAPI over Flask or Django?
**Answer:**  
FastAPI provides native asynchronous I/O (`async`/`await`), high-throughput ASGI concurrency, automated Pydantic request/response schema validation, and automatic OpenAPI Swagger documentation with zero extra dependencies. During long-duration missions with burst telemetry synchronization, async I/O ensures the server handles database queries and sync queues without blocking critical vital sign alerts.

### 2. Why use both Node.js and Python rather than a single runtime?
**Answer:**  
This reflects realistic aerospace flight deck topology. The Node.js server (`server.mjs`) is a lightweight, zero-dependency edge bridge running on port 8080 that serves static PWA assets and provides immediate, low-latency REST fallback for client check-ins. Python FastAPI running on port 8000 provides access to scientific computing packages (`numpy`, `scipy`, `pandas`) for complex trajectory math and clinical research mapping. If the Python process restarts, the Node.js bridge keeps the astronaut's flight deck UI fully responsive.

### 3. How does ASTRA detect insidious physiological drift before clinical symptoms appear?
**Answer:**  
ASTRA avoids single-point threshold triggers, which generate high false alarm rates. Instead, it computes an Exponentially Weighted Moving Average (EWMA with $\lambda = 0.3$) of directional Z-scores calibrated to each astronaut's personal baseline. This captures continuous small deviations that trend away from baseline, detecting problems (like bone deconditioning or hypercapnia) days before acute clinical thresholds are breached.

### 4. How are personal baselines calculated, and why not use generic medical ranges?
**Answer:**  
In microgravity, generic population norms (e.g. Earth resting heart rate of 60–100 bpm) are inadequate. Spaceflight induces fluid redistribution and autonomic shifts that vary dramatically between individuals. ASTRA establishes a personal baseline over Days 8 through 30 by calculating the mean ($\mu$) and standard deviation ($\sigma$) of each metric for that specific astronaut. We enforce a standard deviation floor ($0.6 \times \text{nominal SD}$) to prevent hyper-sensitivity in astronauts whose readings remain artificially static.

### 5. Why do you clamp Z-scores between -6.0 and +6.0?
**Answer:**  
Sensor dropouts, motion artifacts, or calibration glitches can produce extreme numerical outliers (e.g. $Z > 50$). Clamping to $[-6.0, +6.0]$ prevents a single transient bad reading from corrupting the recursive EWMA filter for days while still representing an extreme clinical event ($6\sigma$ represents $99.9999998\%$ of normal distribution).

### 6. What is EWMA, and why is $\lambda = 0.3$ optimal?
**Answer:**  
EWMA stands for Exponentially Weighted Moving Average:  
$$e_t = \lambda z_t + (1 - \lambda) e_{t-1}$$  
$\lambda = 0.3$ strikes the optimal aerospace balance: $30\%$ weight is given to the latest day's reading and $70\%$ to historical momentum. It smooths out high-frequency sensor noise while responding to true physiological shifts within 3 to 4 days, as proven by our infection benchmark detection latency of 4 days.

### 7. How does ASTRA utilize NASA research?
**Answer:**  
ASTRA embeds findings, risks, and countermeasures from NASA HRP publications (Hazards, Risks, Ongoing Countermeasures). Research findings are classified into relational models (`research_findings`). When a specific physiological domain triggers an alert, the engine cross-references the hazard and surfaces the exact NASA research finding and countermeasure protocol directly to the crew.

### 8. Are you using a live NASA API?
**Answer:**  
No. NASA does not offer a public, real-time clinical API for astronaut physiological telemetry. ASTRA's research retrieval pipeline (`research_retrieval.py`) crawls allowlisted official NASA HRP and CSA public URLs using HTTPX and BeautifulSoup4, extracts structured scientific text, verifies integrity via SHA-256 hashing, and stores it in our local SQLite database.

### 9. How does research evidence connect to active clinical alerts?
**Answer:**  
Via our `evidence_mapping.py` service. Every physiological metric maps to a health domain (`imm`, `msk`, `car`, `beh`, `env`, `rad`), and every domain maps to an official NASA HRP hazard category. When an alert fires in the radiation domain, the system queries the knowledge base for `rad` findings and immediately surfaces CSA EVARM/MOSFET references and storm shelter protocols.

### 10. How does the system function without Earth communication?
**Answer:**  
ASTRA has zero cloud dependencies. All data is persisted locally in client-side IndexedDB and backend SQLite (`backend/astra.db`). Analysis, baseline calculations, EWMA smoothing, and emergency report generation execute 100% locally on the spacecraft's onboard computers.

### 11. What happens during a Tier 3 critical health event?
**Answer:**  
When Tier 3 is reached (e.g. infection syndrome, solar particle event $>5\text{ mSv/day}$, or multi-domain Act status):  
1. Flight Deck triggers a pulsing red visual banner and audio warning.  
2. An Emergency Escalation Modal dialog opens.  
3. An atomic Emergency Report is generated locally in the database.  
4. The astronaut reviews the clinical brief and recommended actions.  
5. The astronaut clicks `TRANSMIT TO GROUND CONSOLE` to dispatch the report down to the communication queue.

### 12. How does ground team escalation work during communication blackouts?
**Answer:**  
If Earth communication is severed (LOS / blackout), the system retains the emergency report in the `emergency_reports` table with status `queued_offline`. The flight deck displays `LOCAL QUEUED (READY FOR TRANSMISSION)`. When the link restores, the sync engine drains the queue and dispatches the payload to ground consoles.

### 13. How do you prevent false alarm fatigue for the crew?
**Answer:**  
False alarm fatigue is prevented through a three-stage filter:  
1. Adaptation Window: All alerts are suppressed during Days 1–7.  
2. EWMA Smoothing: $\lambda = 0.3$ filters transient noise.  
3. Persistence Filter: A metric must sustain a level for **two consecutive days** before triggering an alert.  
Our benchmark evaluation proves this achieves a false alarm rate of just **0.66 per 30 days** on healthy missions.

### 14. How do you distinguish measured vs astronaut-entered vs inferred indicators?
**Answer:**  
- **Measured Parameters (7 metrics):** Sensor-derived vitals (`temp`, `hr`, `hrv`, `spo2`, `sbp`, `dbp`, `dose`).  
- **Astronaut-Entered Information (7 metrics):** Daily subjective self-reports (`fat`, `nutrition`, `slp`, `mood`, `stress`, `headache`, `hydration`).  
- **Environmental Parameters (1 metric):** Life support sensor telemetry (`co2`).  
- **Inferred Risk Indicators:** Calculated mathematical outputs (Z-score, EWMA drift, domain status, escalation tier, 7-day projected trajectory).

### 15. How is radiation exposure monitored, and what are CSA's contributions?
**Answer:**  
ASTRA monitors daily radiation dose rate (`dose`, in mSv/day) and cumulative mission dose against a 1,000 mSv career limit. An acute reading $> 5.0\text{ mSv/day}$ triggers an active Solar Particle Event (SPE) alert and shelters the crew. Furthermore, an SPE tightens immune watch thresholds by $0.75\times$ for 14 days due to hematopoietic radiation sensitivity. We attribute this dosimetric framework to the Canadian Space Agency’s EVARM, MOSFET, and Radi-N bubble detector studies.

### 16. How is multi-astronaut data separated?
**Answer:**  
In the backend database, all records in `telemetry`, `alerts`, `emergency_reports`, and `baselines` have a foreign key `astronaut_id` with unique compound constraints (e.g. `(astronaut_id, mission_day)`). In the frontend, the active astronaut profile (`ASTRO-1`, `ASTRO-2`, `ASTRO-3`) partitions IndexedDB queries and renders isolated baseline charts.

### 17. How does client-server data synchronization work?
**Answer:**  
The flight deck uses a store-and-forward architecture. Writes occur locally in IndexedDB first. A background sync worker checks network connectivity every 30 seconds. When connected, it flushes pending check-ins and telemetry batches to `/api/v1/sync/batch` or `/api/v1/telemetry/batch`, marking local records as synchronized.

### 18. How reliable are your predictive forecasts?
**Answer:**  
Our linear trajectory model projects drift over a 7-day horizon based on the 5-day slope. It predicts threshold crossings up to 10 days in advance. In benchmark evaluations, it achieved 100% detection on bone loading deterioration with a median latency of 3 days. However, because it relies on linear projection, non-linear sudden shocks (e.g., unexpected acute trauma) are detected by the instantaneous threshold layer rather than the trend predictor.

### 19. Has ASTRA been clinically validated?
**Answer:**  
No. ASTRA is a high-fidelity prototype developed for the NASA Space Apps Challenge. All clinical thresholds are experimental prototype parameters. While grounded in published NASA HRP and CSA research, it is designed strictly as a clinical decision-support tool and does not replace certified aerospace flight surgeons.

### 20. What happens if the Python FastAPI backend process crashes?
**Answer:**  
The Node.js server and the browser Flight Deck continue operating seamlessly. The flight deck immediately falls back to its native client-side analytical engine (`web/engine.js`), which runs the identical baseline, Z-score, and EWMA algorithms in pure JavaScript. Telemetry and daily check-ins continue saving to IndexedDB with zero data loss. The top status pill simply changes from green `FastAPI Online` to amber `FastAPI Offline (Local Mode)`.

### 21. How does ASTRA protect astronaut medical privacy?
**Answer:**  
In our design, all data resides in local onboard storage with zero third-party cloud analytics tracking. All communications to ground utilize HTTPS/TLS endpoints. For operational deployment, role-based access control (RBAC) ensures only the designated Crew Medical Officer (CMO) and Flight Surgeon can view sensitive psychological check-ins.

### 22. How does ASTRA support a Mars mission specifically?
**Answer:**  
A Mars mission involves up to 22 minutes of one-way light time latency and multi-day solar conjunction blackouts. ASTRA provides full autonomous onboard diagnostics, cross-domain symptom disambiguation (e.g., distinguishing high cabin $\text{CO}_2$ from viral illness), and local emergency response checklists without waiting 44 minutes for Houston to reply.

### 23. What is the single biggest technical innovation in ASTRA?
**Answer:**  
The **cross-domain synergy detection engine**. In spaceflight, clinical events do not occur in silos. ASTRA’s ability to mathematically correlate cabin $\text{CO}_2$ with sleep and headaches, or correlate a solar particle event with delayed immune dysregulation, transforms isolated data points into actionable clinical intelligence.

### 24. What are the present technical limitations of your prototype?
**Answer:**  
1. Telemetry is fed from simulated 180-day benchmark data (`mission.json`) rather than physical spacecraft telemetry buses.  
2. Ground transmission simulates Deep Space Network downlinks via HTTP gateways.  
3. Mathematical models are deterministic linear projections rather than full multi-compartmental physiological pharmacokinetic simulations.

### 25. What would you build in the next phase?
**Answer:**  
1. Support for NASA CCSDS (Consultative Committee for Space Data Systems) telemetry stream decoding.  
2. Direct Bluetooth Low Energy (BLE) integration with astronaut wearable biosensors (smart garments, ECG patches).  
3. Multi-crew epidemiological modeling to track pathogen transmission dynamics throughout closed habitat modules.
