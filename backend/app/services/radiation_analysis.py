from __future__ import annotations

from typing import Optional


CSA_RADIATION_INSTRUMENTS = [
    {
        "name": "EVARM",
        "full_name": "Extravehicular Activity Radiation Monitoring",
        "description": "Measures real-time radiation dose received by astronauts during spacewalks with badge dosimeters.",
        "agency": "Canadian Space Agency (CSA)",
    },
    {
        "name": "MOSFET Dosimeter",
        "full_name": "Metal-Oxide-Semiconductor Field-Effect Transistor Dosimeter",
        "description": "Miniaturized semiconductor dosimeters providing instantaneous skin and organ radiation dose readouts.",
        "agency": "Canadian Space Agency (CSA)",
    },
    {
        "name": "Radi-N",
        "full_name": "Radi-N Neutron Field Study",
        "description": "ISS bubble dosimeter system designed to characterize the biological equivalent dose from neutron radiation.",
        "agency": "Canadian Space Agency (CSA) & Roscosmos",
    },
    {
        "name": "CANS",
        "full_name": "Crew Altitude Notification System",
        "description": "Real-time dosimetric alerting system for acute cosmic ray and SPE events.",
        "agency": "Canadian Space Agency (CSA)",
    },
]


def classify_radiation_status(
    cumulative_msv: float,
    daily_msv: float,
    limit_msv: float = 1000.0,
    spe_threshold: float = 5.0,
) -> str:
    """Classify radiation status: 'nominal', 'watch', or 'act'."""
    if daily_msv >= spe_threshold:
        return "act"
    if (cumulative_msv / limit_msv) > 0.5 or daily_msv >= 1.5:
        return "watch"
    return "nominal"


def analyze_radiation(
    series_dose: list[Optional[float]],
    mission_day: int,
    mission_limit_msv: float = 1000.0,
    spe_threshold: float = 5.0,
) -> dict:
    """
    Detailed radiation monitoring and cumulative dose analysis.
    """
    cumulative = 0.0
    spe_day = None
    spe_detected = False

    for d in range(1, mission_day + 1):
        idx = d - 1
        val = series_dose[idx] if idx < len(series_dose) and series_dose[idx] is not None else 0.4
        cumulative += val
        if val >= spe_threshold:
            spe_detected = True
            spe_day = d

    current_idx = mission_day - 1
    current_dose = (
        series_dose[current_idx]
        if current_idx < len(series_dose) and series_dose[current_idx] is not None
        else 0.4
    )

    fraction = cumulative / mission_limit_msv
    status = classify_radiation_status(cumulative, current_dose, mission_limit_msv, spe_threshold)

    # Trend calculation
    recent_vals = [
        series_dose[i]
        for i in range(max(0, mission_day - 7), mission_day)
        if i < len(series_dose) and series_dose[i] is not None
    ]
    if len(recent_vals) >= 2:
        diff = recent_vals[-1] - recent_vals[0]
        trend = "increasing" if diff > 0.1 else "decreasing" if diff < -0.1 else "stable"
    else:
        trend = "stable"

    csa_summary = (
        "CSA space radiation research integrates EVARM spacewalk dosimetry and MOSFET real-time sensors. "
        "Neutron spectrometry from the Radi-N project indicates deep-space secondary radiation represents "
        "up to 30% of equivalent biological damage."
    )

    return {
        "mission_day": mission_day,
        "current_dose": round(current_dose, 3),
        "cumulative_dose": round(cumulative, 1),
        "mission_limit_msv": mission_limit_msv,
        "fraction_of_limit": round(fraction, 4),
        "spe_detected": spe_detected,
        "spe_day": spe_day,
        "status": status,
        "trend": trend,
        "csa_context": csa_summary,
        "csa_instruments": CSA_RADIATION_INSTRUMENTS,
        "prototype_disclaimer": "Thresholds are prototype indicators for demonstration purposes only.",
    }
