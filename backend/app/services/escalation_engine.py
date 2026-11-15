from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from app.services.evidence_mapping import get_evidence_for_alert

TIER_0 = 0  # Nominal
TIER_1 = 1  # Attention — warning, explain metrics, suggest protocol
TIER_2 = 2  # High Priority — recommend ground review, show CONTACT GROUND TEAM
TIER_3 = 3  # Critical — CRITICAL ALERT, CONTACT GROUND TEAM NOW button, emergency report

TIER_NAMES = {
    0: "NOMINAL",
    1: "ATTENTION",
    2: "HIGH PRIORITY",
    3: "CRITICAL HEALTH EVENT",
}

RECOMMENDED_ACTIONS = {
    "imm": [
        "Hydrate and log core temperature every 4 hours.",
        "Maintain physical isolation from crewmembers if respiratory symptoms occur.",
        "Prepare CMO diagnostic kit for viral/bacterial antigen panel.",
    ],
    "msk": [
        "Resume ARED resistive loading regimen with flight surgeon guidance.",
        "Perform dynamometer grip strength re-measurement.",
        "Verify dietary caloric and protein intake meets microgravity countermeasure target.",
    ],
    "car": [
        "Perform continuous ECG Lead II rhythm strip evaluation.",
        "Drink oral electrolyte rehydration solution (0.5L).",
        "Monitor blood pressure and orthostatic symptoms upon module transfers.",
    ],
    "beh": [
        "Implement sleep hygiene protocol: dim cabin lighting, disconnect displays 1h before sleep.",
        "Schedule private psychological conference with Ground Flight Surgeon.",
        "Complete cognitive vigilance self-test.",
    ],
    "env": [
        "Immediately inspect cabin life support CDRA / Metox CO2 scrubbers.",
        "Verify cabin ventilation airflow velocity and sensor calibration.",
        "Don emergency breathing masks if CO2 exceeds operational limits.",
    ],
    "rad": [
        "Relocate immediately to central water-wall radiation storm shelter.",
        "Don personal dosimeters and verify EVARM/MOSFET sensor telemetry.",
        "Limit physical exertion and remain sheltered until Solar Particle Event passes.",
    ],
}


def classify_tier(analysis_result: dict) -> int:
    return int(analysis_result.get("overall", {}).get("tier", 0))


def should_trigger_emergency(analysis_result: dict) -> bool:
    return classify_tier(analysis_result) == TIER_3


def generate_alert_message(analysis_result: dict, astronaut_id: str) -> dict:
    tier = classify_tier(analysis_result)
    worst_domain = analysis_result.get("overall", {}).get("worstDomain", "car")
    contributors = analysis_result.get("contributors", [])

    if tier == TIER_3:
        msg = f"CRITICAL HEALTH EVENT DETECTED for {astronaut_id}: Severe physiological drift across multiple domains or acute operational event."
        escalation_text = "IMMEDIATE GROUND CONTACT RECOMMENDED. Complete emergency assessment protocol."
    elif tier == TIER_2:
        msg = f"HIGH PRIORITY HEALTH ALERT for {astronaut_id}: Sustained drift in {worst_domain.upper()} domain exceeding clinical watch parameters."
        escalation_text = "Advise consultation with Ground Medical Officer at next pass."
    elif tier == TIER_1:
        msg = f"ATTENTION ALERT for {astronaut_id}: Mild drift detected in {worst_domain.upper()} domain."
        escalation_text = "Self-manage and recheck vitals in next daily check-in."
    else:
        msg = f"Vitals nominal for {astronaut_id}."
        escalation_text = "Continue routine mission schedule."

    actions = RECOMMENDED_ACTIONS.get(worst_domain, [
        "Review daily telemetry trends.",
        "Consult astronaut health protocol manual."
    ])

    return {
        "tier": tier,
        "tier_name": TIER_NAMES.get(tier, "UNKNOWN"),
        "domain": worst_domain,
        "message": msg,
        "escalation_text": escalation_text,
        "recommended_actions": actions,
        "contact_ground": tier >= TIER_2,
        "contributors": [c.get("text", "") for c in contributors],
    }


def generate_emergency_report(
    astronaut_id: str,
    analysis_result: dict,
    alert_message: dict,
    alert_id: Optional[int] = None,
) -> dict:
    mission_day = analysis_result.get("day", 1)
    tier = classify_tier(analysis_result)
    worst_domain = analysis_result.get("overall", {}).get("worstDomain", "car")
    evidence = get_evidence_for_alert(worst_domain, tier)

    report_payload = {
        "report_id": f"EMERGENCY-D{mission_day}-{astronaut_id}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "astronaut_id": astronaut_id,
        "mission_day": mission_day,
        "escalation_tier": tier,
        "tier_classification": TIER_NAMES.get(tier, "UNKNOWN"),
        "primary_domain": worst_domain,
        "domain_name": evidence.get("domain_name", worst_domain),
        "alert_message": alert_message.get("message", ""),
        "contributing_patterns": alert_message.get("contributors", []),
        "recommended_actions": alert_message.get("recommended_actions", []),
        "evidence_summary": evidence.get("summary", {}),
        "source_attributions": evidence.get("source_attribution", []),
        "disclaimer": (
            "ASTRA PROTOTYPE EMERGENCY REPORT: Generated for flight simulation and evaluation. "
            "Thresholds and alerts are experimental decision-support prototypes and do not replace "
            "certified aerospace medical flight surgeons."
        ),
    }

    human_readable = (
        f"=== ASTRA EMERGENCY MEDICAL ESCALATION REPORT ===\n"
        f"Report ID: {report_payload['report_id']}\n"
        f"Timestamp: {report_payload['timestamp']}\n"
        f"Astronaut: {astronaut_id} | Mission Day: {mission_day}\n"
        f"Severity: TIER {tier} - {TIER_NAMES.get(tier, 'UNKNOWN')}\n"
        f"Primary Domain: {report_payload['domain_name']} ({worst_domain})\n\n"
        f"ASSESSMENT:\n{alert_message.get('message', '')}\n\n"
        f"CONTRIBUTING SYNERGIES:\n"
        + ("\n".join(f"- {c}" for c in alert_message.get("contributors", [])) or "- None recorded")
        + f"\n\nIMMEDIATE ACTIONS REQUIRED:\n"
        + "\n".join(f"[{i+1}] {a}" for i, a in enumerate(alert_message.get("recommended_actions", [])))
        + f"\n\nGROUND TELEMETRY TRANSMISSION STATUS: QUEUED FOR DOWNLINK\n"
        + f"===============================================\n"
    )

    return {
        "astronaut_id": astronaut_id,
        "mission_day": mission_day,
        "tier": tier,
        "alert_id": alert_id,
        "content_json": report_payload,
        "human_readable": human_readable,
    }
