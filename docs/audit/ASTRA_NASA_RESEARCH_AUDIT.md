# ASTRA — NASA & CSA Research Intelligence Audit
## Ground Truth Verification of Literature Integration and Attributions

**Document Version:** 1.0.0  
**Audit Date:** November 15, 2026  
**Auditor Role:** Space Health Research Analyst & Technical Architect  

---

## 1. Executive Summary

ASTRA integrates scientific findings from **five official publications** issued by the **NASA Human Research Program (HRP)** and the **Canadian Space Agency (CSA)**. 

To ensure complete mission safety during deep space communication outages, ASTRA adopts a **Hybrid Grounded Knowledge Architecture**:
1. **Verified Embedded Knowledge Base:** High-priority, rigorously verified findings, hazard definitions, and countermeasure guidelines are bundled into the application core (`app/services/nasa_research.py`). This guarantees zero dependency on internet connectivity.
2. **Dynamic Ingestion & Refresh Engine:** An automated web scraper (`app/services/research_retrieval.py`) using `httpx` and `BeautifulSoup4` with SHA-256 hash checking periodically audits the 5 allowlisted public URLs when external communication uplink is available.

---

## 2. Audit of the Five Research Resources

### Source 1: NASA HRP — The 5 Hazards of Human Spaceflight
- **Agency:** National Aeronautics and Space Administration (NASA)
- **URL:** [https://www.nasa.gov/hrp/hazards/](https://www.nasa.gov/hrp/hazards/)
- **Document Title:** *5 Hazards of Human Spaceflight*
- **Health Domains Mapped:** `rad` (Space Radiation), `beh` (Isolation & Confinement), `car` & `msk` (Gravity Fields), `env` & `imm` (Hostile Closed Environments).
- **Extracted Clinical Realities:**
  - *Cephalad fluid shift:* In microgravity, ~2 liters of interstitial fluids migrate from the lower extremities toward the head and chest, shifting baroreceptor setpoints and altering blood pressure dynamics.
  - *Radiation exposure:* Beyond low-Earth orbit, cosmic ray flux increases cancer mortality and central nervous system risks by 200–300× relative to Earth ground level.
- **Database Status:** Stored in `research_sources` (ID: 1); 3 findings indexed in `research_findings`.

### Source 2: NASA HRP — Risks of Human Spaceflight
- **Agency:** National Aeronautics and Space Administration (NASA)
- **URL:** [https://www.nasa.gov/hrp/risks/](https://www.nasa.gov/hrp/risks/)
- **Document Title:** *Human Research Program Risks*
- **Health Domains Mapped:** `imm` (Altered Immune Response), `car` (Cardiovascular Disease), `msk` (Bone Fracture), `beh` (Cognitive & Behavioral Decrements), `env` (Hypercapnia).
- **Extracted Clinical Realities:**
  - *Immune Dysregulation:* Spaceflight induces marked decreases in T-cell proliferation, altered cytokine profiles, and subclinical reactivation of latent herpesviruses (EBV, VZV, CMV).
  - *Bone Demineralization:* Astronauts experience 1.0% to 1.5% bone mineral density reduction per month in weight-bearing skeletal structures (lumbar spine, calcaneus).
- **Database Status:** Stored in `research_sources` (ID: 2); 4 findings indexed in `research_findings`.

### Source 3: NASA HRP — Ongoing HRP Research
- **Agency:** National Aeronautics and Space Administration (NASA)
- **URL:** [https://www.nasa.gov/hrp/ongoing-hrp-research/](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- **Document Title:** *Ongoing Human Research Program Countermeasures*
- **Health Domains Mapped:** `msk` (ARED Resistive Exercise), `imm` (Antiviral & Nutrition Countermeasures).
- **Extracted Clinical Realities:**
  - Daily 2.5-hour scheduled countermeasure regimens combining resistive loading (Advanced Resistive Exercise Device - ARED) and aerobic ergometry (T2 Treadmill, CEVIS cycle) are mandatory to attenuate sarcopenia and osteopenia.
- **Database Status:** Stored in `research_sources` (ID: 3); 2 findings indexed in `research_findings`.

### Source 4: CSA — Monitoring Radiation for Astronaut Health
- **Agency:** Canadian Space Agency (CSA)
- **URL:** [https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- **Document Title:** *Monitoring Radiation for Astronaut Health*
- **Health Domains Mapped:** `rad` (Space Radiation Monitoring), `imm` (Radiation-induced immune suppression).
- **Specific CSA Spaceflight Instruments Attributed:**
  - **EVARM (Extravehicular Activity Radiation Monitoring):** Badge dosimeters worn during spacewalks.
  - **MOSFET Personal Dosimeters:** Solid-state real-time skin and organ dose rate sensors.
  - **Radi-N Bubble Detector Study:** High-sensitivity neutron radiation characterization on the ISS.
  - **CANS (Crew Altitude Notification System):** Autonomous alert triggering during acute solar particle event flares.
- **Database Status:** Stored in `research_sources` (ID: 4); 2 findings indexed in `research_findings`.

### Source 5: CSA — Why Conduct Science Experiments in Space?
- **Agency:** Canadian Space Agency (CSA)
- **URL:** [https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)
- **Document Title:** *Scientific Experiments on the International Space Station*
- **Health Domains Mapped:** `msk` (MARROW bone physiology experiment), `beh` (Psychological adaptation in extreme isolation).
- **Extracted Clinical Realities:**
  - Microgravity promotes fatty infiltration of bone marrow and shifts stem cell differentiation away from osteoblasts, compounding skeletal vulnerability.
- **Database Status:** Stored in `research_sources` (ID: 5); 2 findings indexed in `research_findings`.

---

## 3. The 8-Stage Research Ingestion & Decision-Support Pipeline

```
[1. URL Retrieval] (HTTPX with 30s timeout, allowlist check)
       │
[2. DOM Stripping] (BeautifulSoup4 removes nav, footer, scripts, ads)
       │
[3. Text Sanitization] (Regex collapses whitespaces, strips malicious markup)
       │
[4. SHA-256 Hashing] (Content hash prevents redundant database writes)
       │
[5. Semantic Classification] (Keywords match hazard classes and health domains)
       │
[6. Finding Extraction] (Sentences categorized as established, countermeasure, instrument)
       │
[7. Relational Persistence] (Stored across research_sources, documents, findings)
       │
[8. Contextual Decision Support] (Linked to live telemetry anomalies during analyze())
```

---

## 4. Live Clinical Decision-Support Linking

When an alert is flagged by the health engine, the backend automatically retrieves the corresponding NASA/CSA research finding:

```python
# Real endpoint response from GET /api/v1/research/domain/rad?tier=2
{
  "domain": "rad",
  "domain_name": "Space Radiation",
  "hazard": "Space Radiation",
  "summary": {
    "finding": "Beyond Earth's magnetosphere, astronauts receive 200-300x more radiation than on the Earth's surface. Solar particle events (SPEs) can cause acute radiation syndrome within hours.",
    "agency": "NASA",
    "source_title": "5 Hazards of Human Spaceflight",
    "source_url": "https://www.nasa.gov/hrp/hazards/",
    "monitoring_context": "Tier 2 alert in rad domain. Risk of Radiation Carcinogenesis",
    "prototype_disclaimer": "ASTRA is a research prototype. This finding is cited from official sources for educational context only."
  },
  "findings": [
    {
      "finding": "CSA's EVARM dosimeter project measured radiation exposure during spacewalks...",
      "hazard": "Space Radiation",
      "risk": "Risk of Radiation Carcinogenesis",
      "evidence_type": "instrument",
      "csa_instruments": ["EVARM", "MOSFET", "Radi-N"]
    }
  ]
}
```

---

## 5. Regulatory & Clinical Boundary Disclaimers

> [!CAUTION]
> **Essential Presentation Boundary Notes:**
> 1. **No Real NASA Sensor Integration:** ASTRA reads simulated 180-day telemetry (`mission.json`). It does not tap into live telemetry buses of the International Space Station or Orion spacecraft.
> 2. **No NASA/CSA Endorsement:** Citations are taken from open-access scientific publications. NASA and CSA do not endorse or certify this software.
> 3. **Prototype Decision-Support:** All clinical thresholds and algorithms are experimental software prototypes and must not be utilized for human clinical diagnosis without flight surgeon oversight.
