"""
NASA/CSA Research Knowledge Base for ASTRA.
Content is derived from and rigorously attributed to official NASA HRP and CSA publications.

Sources:
  [1] NASA HRP Hazards: https://www.nasa.gov/hrp/hazards/
  [2] NASA HRP Risks: https://www.nasa.gov/hrp/risks/
  [3] NASA HRP Research: https://www.nasa.gov/hrp/ongoing-hrp-research/
  [4] CSA Radiation Monitoring: https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
  [5] CSA Space Science: https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp

DISCLAIMER: ASTRA is a prototype decision-support tool. It does not constitute medical advice
and is not endorsed by NASA or CSA. All thresholds are prototype values, not certified clinical limits.
NASA does not endorse any non-U.S. Government entity or product.
"""

from __future__ import annotations
from typing import Optional

RESEARCH_SOURCES = [
    {
        "id": 1,
        "agency": "NASA",
        "title": "5 Hazards of Human Spaceflight",
        "url": "https://www.nasa.gov/hrp/hazards/",
        "status": "verified",
    },
    {
        "id": 2,
        "agency": "NASA",
        "title": "Risks of Human Spaceflight",
        "url": "https://www.nasa.gov/hrp/risks/",
        "status": "verified",
    },
    {
        "id": 3,
        "agency": "NASA",
        "title": "Ongoing HRP Research",
        "url": "https://www.nasa.gov/hrp/ongoing-hrp-research/",
        "status": "verified",
    },
    {
        "id": 4,
        "agency": "CSA",
        "title": "Monitoring Radiation for Astronaut Health",
        "url": "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
        "status": "verified",
    },
    {
        "id": 5,
        "agency": "CSA",
        "title": "Why Conduct Science Experiments in Space?",
        "url": "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
        "status": "verified",
    },
]

DOMAIN_FINDINGS = {
    "rad": [
        {
            "finding": "Beyond Earth's magnetosphere, astronauts receive 200-300x more radiation than on the Earth's surface. Solar particle events (SPEs) can cause acute radiation syndrome within hours.",
            "hazard": "Space Radiation",
            "risk": "Risk of Radiation Carcinogenesis",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[0],
            "csa_instruments": [
                "EVARM (Extravehicular Activity Radiation Monitoring)",
                "MOSFET dosimeters",
                "CANS (Crew Altitude Notification System)",
                "Radi-N neutron dosimeter",
            ],
        },
        {
            "finding": "Cumulative galactic cosmic radiation (GCR) exposure significantly raises lifetime excess risk of cancer mortality and degenerative vascular disease. Threshold monitoring ensures crew stays within ALARA standards.",
            "hazard": "Space Radiation",
            "risk": "Risk of Acute or Late Central Nervous System Effects from Space Radiation",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[1],
        },
        {
            "finding": "CSA's EVARM dosimeter project measured radiation exposure during spacewalks, showing that personal dosimeters placed on limbs and torso capture localized fluence peaks.",
            "hazard": "Space Radiation",
            "risk": "Risk of Radiation Carcinogenesis",
            "evidence_type": "instrument",
            "source": RESEARCH_SOURCES[3],
            "csa_instruments": ["EVARM", "MOSFET", "Radi-N"],
        },
    ],
    "imm": [
        {
            "finding": "Spaceflight causes significant immune dysregulation: T-cell counts drop, latent herpesviruses (EBV, CMV, VZV) reactivate, and wound healing slows. Even mild infections can escalate rapidly with limited medical resources on board.",
            "hazard": "Hostile Closed Environment",
            "risk": "Risk of Adverse Health Outcomes Due to Altered Immune Response",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[1],
        },
        {
            "finding": "Subtle shifts in core body temperature and elevated resting fatigue in microgravity correlate with latent viral shedding and subclinical immune challenges.",
            "hazard": "Hostile Closed Environment",
            "risk": "Risk of Adverse Health Outcomes Due to Altered Immune Response",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[2],
        },
    ],
    "car": [
        {
            "finding": "Microgravity causes cephalad fluid shifts (fluid moves toward the head), leading to facial puffiness, altered baroreflex sensitivity, and cardiac stroke volume redistribution.",
            "hazard": "Gravity Fields (Microgravity)",
            "risk": "Risk of Cardiovascular Disease and Cardiac Rhythm Problems",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[0],
        },
        {
            "finding": "Long-duration missions are associated with arterial stiffness increases and microvascular remodeling. Decreased HRV indicates autonomic stress and blunted parasympathetic tone.",
            "hazard": "Gravity Fields (Microgravity)",
            "risk": "Risk of Cardiovascular Disease",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[1],
        },
    ],
    "msk": [
        {
            "finding": "In microgravity, astronauts lose approximately 1-2% bone mineral density per month in weight-bearing bones (lumbar spine, femoral neck), with up to 20% loss in skeletal muscle volume.",
            "hazard": "Gravity Fields (Microgravity)",
            "risk": "Risk of Bone Fracture",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[0],
        },
        {
            "finding": "NASA Human Research Program mandates ~2.5 hours of daily resistive and aerobic countermeasure exercise (e.g. ARED and T2 treadmill) to preserve neuromuscular loading and bone architectural integrity.",
            "hazard": "Gravity Fields (Microgravity)",
            "risk": "Risk of Muscle Mass Loss and Early Onset Osteopenia",
            "evidence_type": "countermeasure",
            "source": RESEARCH_SOURCES[2],
        },
        {
            "finding": "CSA experiments on the ISS (such as MARROW and At Home in Space) show changes in bone marrow fat and cellular differentiation under microgravity, emphasizing rapid tracking of grip strength drops.",
            "hazard": "Gravity Fields (Microgravity)",
            "risk": "Risk of Bone Fracture and Muscle Loss",
            "evidence_type": "ongoing_research",
            "source": RESEARCH_SOURCES[4],
        },
    ],
    "beh": [
        {
            "finding": "Isolation, confinement, sensory monotony, and high operational tempo are primary psychological stressors. Behavioral health programs monitor sleep latency, subjective mood drift, and cognitive vigilance.",
            "hazard": "Isolation and Confinement",
            "risk": "Risk of Adverse Cognitive or Behavioral Health Conditions and Psychiatric Disorders",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[0],
        },
        {
            "finding": "Disrupted circadian rhythms and sleep deprivation reduce attention span, impair interpersonal cohesion, and lower pain tolerance, frequently presenting as recurrent headaches.",
            "hazard": "Isolation and Confinement",
            "risk": "Risk of Performance Decrements Due to Inadequate Psychosocial Adaptation",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[1],
        },
    ],
    "env": [
        {
            "finding": "Cabin CO2 levels as low as 0.5% (approx 3.8 mmHg / 5000 ppm) can cause frontal headaches, cognitive slowing, visual disturbances, and sleep disruption in microgravity due to altered cerebral perfusion.",
            "hazard": "Hostile Closed Environment",
            "risk": "Risk of Adverse Health and Performance Effects of Hypercapnia",
            "evidence_type": "established",
            "source": RESEARCH_SOURCES[0],
        },
    ],
}


def get_all_sources() -> list[dict]:
    return RESEARCH_SOURCES


def get_findings_for_domain(domain: str) -> list[dict]:
    return DOMAIN_FINDINGS.get(domain, [])


def get_research_summary_for_alert(domain: str, tier: int) -> dict:
    findings = DOMAIN_FINDINGS.get(domain, [])
    if not findings:
        return {}
    best = next((f for f in findings if f.get("evidence_type") == "established"), findings[0])
    return {
        "finding": best["finding"],
        "source_url": best["source"]["url"],
        "agency": best["source"]["agency"],
        "source_title": best["source"]["title"],
        "hazard": best.get("hazard", "Spaceflight Environment"),
        "risk": best.get("risk", "Human System Risk"),
        "monitoring_context": f"Tier {tier} alert in {domain} domain. Documented by NASA HRP / CSA research.",
        "prototype_disclaimer": "ASTRA is a research prototype. This finding is cited from official sources for educational context only.",
    }
