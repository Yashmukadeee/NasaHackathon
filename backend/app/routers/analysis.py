from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.health import (
    AssessmentRequest,
    AssessmentResponse,
    PredictedCommand,
)
from app.services.health_engine import (
    analyze,
    ground_summary,
    load_mission_telemetry,
    prepare,
)
from app.services.risk_prediction import forecast_days_to_amber, predict_risk_trajectory
from app.services.nasa_research import DOMAIN_FINDINGS, RESEARCH_SOURCES
from app.services.evidence_mapping import DOMAIN_NAMES, DOMAIN_HAZARD_MAP

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/assess", response_model=AssessmentResponse)
async def assess_health_data(
    req: AssessmentRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Autonomous CDSS assessment endpoint.
    Receives combined telemetry (manual astronaut check-in + automated sensor streams),
    computes baseline deviations & EWMA drifts, queries NASA/CSA research knowledge base,
    and generates prioritized, evidence-grounded action commands for the astronaut.
    """
    # Validate API key if configured
    provided_key = req.api_key or x_api_key
    if settings.FASTAPI_API_KEY:
        if not provided_key or provided_key != settings.FASTAPI_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid or missing FastAPI authentication key")

    # Load baseline mission series
    series = load_mission_telemetry(req.astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {req.astronaut_id} not found in mission telemetry")

    day = req.mission_day
    cur_len = len(series.get("hr", []))

    # Extend series if day exceeds current length
    if day > cur_len:
        for d in range(cur_len + 1, day + 1):
            for k in list(series.keys()):
                val_to_put = req.vitals.get(k) if d == day else series[k][-1]
                series[k].append(val_to_put)
    else:
        # Update in-place
        for k, v in req.vitals.items():
            if k in series and v is not None:
                series[k][day - 1] = v

    ctx = prepare(series)
    res = analyze(ctx, day)

    tier = res["overall"]["tier"]
    tier_labels = {
        0: "NOMINAL",
        1: "ATTENTION / WATCH",
        2: "HIGH PRIORITY CAUTION",
        3: "CRITICAL HEALTH EVENT",
    }
    tier_label = tier_labels.get(tier, f"TIER {tier}")
    status_label = "Act" if tier >= 2 else "Watch" if tier == 1 else "Normal"
    worst_domain = res["overall"]["worstDomain"]
    worst_domain_name = DOMAIN_NAMES.get(worst_domain, worst_domain.upper())
    primary_hazard = DOMAIN_HAZARD_MAP.get(worst_domain, "Spaceflight Environmental Factors")

    # 1. Compute flagged physiological deviations from baseline
    deviations = []
    for k, cfg in ctx.cfg["metrics"].items():
        val = req.vitals.get(k)
        if val is None and day - 1 < len(series[k]):
            val = series[k][day - 1]
        base = ctx.base.get(k)
        if val is not None and base:
            diff = val - base["mean"]
            sd = base["sd"] if base["sd"] > 0 else 1.0
            z = diff / sd
            drift = ctx.drift[k][day - 1] if day - 1 < len(ctx.drift[k]) else 0.0
            if abs(drift) >= 1.0 or abs(z) >= 1.3:
                deviations.append({
                    "metric_key": k,
                    "metric_name": cfg["name"],
                    "unit": cfg["unit"],
                    "recorded_value": val,
                    "baseline_mean": round(base["mean"], cfg.get("dec", 1)),
                    "difference": round(diff, cfg.get("dec", 1)),
                    "zscore": round(z, 2),
                    "ewma_drift": round(drift, 2),
                    "is_severe": abs(drift) >= 2.0 or abs(z) >= 2.2,
                })

    # 2. Synthesize prioritized, evidence-grounded action commands from NASA/CSA research
    predicted_commands = []
    vitals = req.vitals
    symptoms = req.symptoms or []

    # Infection / Immune Pattern
    if vitals.get("temp", 36.6) >= 37.8 or res["domains"].get("imm", {}).get("rule") == "infection":
        predicted_commands.append(
            PredictedCommand(
                priority="CRITICAL",
                domain="imm",
                title="Immune Deficit & Infection Contingency Protocol",
                command="Quarantine in private crew sleep compartment and close ventilation flap to common galley. Ingest 1000 mL oral electrolyte rehydration solution. Load blood sample into MinION sequencer cartridge.",
                rationale="NASA HRP Evidence: Microgravity induces T-cell dysregulation, cytokine shifts, and latent herpesvirus reactivation (EBV/VZV). Closed spacecraft environment sharply accelerates cross-crew pathogen transmission.",
                evidence_source="NASA HRP Risks of Human Spaceflight: Risk of Host-Microorganism Interactions & CSA Space Science",
                hazard="Hostile Closed Environment",
            )
        )

    # Spaceflight-Associated Neuro-ocular Syndrome (SANS) & Cephalad Pressure
    if vitals.get("headache", 0) >= 5 or "EyeIrritation" in symptoms or "Headache" in symptoms or vitals.get("sbp", 120) >= 135:
        predicted_commands.append(
            PredictedCommand(
                priority="URGENT",
                domain="neu",
                title="SANS & Cephalad Fluid Shift Countermeasure",
                command="Initiate 30-minute Lower Body Negative Pressure (LBNP) chamber session at -25 mmHg. Perform optical coherence tomography (OCT) / Tonopen intraocular pressure check.",
                rationale="NASA HRP Evidence: Microgravity cephalad venous fluid shift elevates intracranial pressure (ICP), causing posterior globe flattening, optic disc edema, and choroidal folds.",
                evidence_source="NASA HRP 5 Hazards: Altered Gravity - SANS Countermeasure Protocol",
                hazard="Altered Gravity Fields",
            )
        )

    # Circadian Sleep & Behavioral Health
    if vitals.get("slp", 8.0) <= 5.5 or vitals.get("fat", 0) >= 7 or vitals.get("stress", 0) >= 7:
        is_urgent = vitals.get("slp", 8.0) <= 5.0 and vitals.get("fat", 0) >= 7
        predicted_commands.append(
            PredictedCommand(
                priority="URGENT" if is_urgent else "WATCH",
                domain="neu",
                title="Circadian Sleep Rest & Neuro-Cognitive Reset",
                command="Enact 24-hour stand-down from EVA prep checklists and robotics. Dim cabin lighting to 450nm-depleted amber spectrum 2 hours before rest cycle. Engage 15-minute VR binaural decompression session.",
                rationale="NASA HRP Evidence: Circadian desynchronization and sleep deprivation (<6.0h) severely degrade psychomotor vigilance, spatial orientation, and operational decision-making.",
                evidence_source="NASA HRP Risks: Risk of Adverse Cognitive and Behavioral Conditions",
                hazard="Isolation and Confinement",
            )
        )

    # Musculoskeletal Loading & Bone Loss Prevention
    if vitals.get("ex", 60) < 40 or vitals.get("grip", 45) <= 36 or res["domains"].get("msk", {}).get("status", 0) >= 1:
        predicted_commands.append(
            PredictedCommand(
                priority="WATCH",
                domain="msk",
                title="Musculoskeletal Loading & Bone Demineralization Countermeasure",
                command="Complete mandatory 60-minute ARED axial resistive loading session (heel-drops and deadlifts at 70% 1-RM). Ingest 25g whey protein isolate with 500 mL water post-exercise.",
                rationale="NASA HRP Evidence: Absence of gravitational loading causes cancellous bone demineralization (1-1.5% bone mineral density loss per month in femoral neck) and Type I muscle fiber atrophy.",
                evidence_source="NASA HRP Hazards: Altered Gravity - Musculoskeletal Countermeasure Program",
                hazard="Altered Gravity Fields",
            )
        )

    # Cardiovascular Fluid Loading & Orthostatic Regulation
    if vitals.get("hydration", 10) < 7 or vitals.get("sbp", 120) >= 135 or vitals.get("dbp", 80) >= 88:
        predicted_commands.append(
            PredictedCommand(
                priority="WATCH",
                domain="car",
                title="Cardiovascular Autonomic Regulation & Fluid Balance",
                command="Ingest 8 oral electrolyte tablets with 1000 mL water. Don gradient lower-limb compression garments (20-30 mmHg) prior to high-acceleration transfer maneuvers.",
                rationale="NASA HRP Evidence: Microgravity baroreflex resetting and decreased circulating plasma volume induce orthostatic intolerance upon gravitational transition.",
                evidence_source="NASA HRP Research: Cardiovascular Regulation in Spaceflight",
                hazard="Altered Gravity Fields",
            )
        )

    # ECLSS Life Support & Cabin CO2
    if vitals.get("co2", 2.0) >= 3.5 or res["domains"].get("env", {}).get("rule") == "habitat":
        predicted_commands.append(
            PredictedCommand(
                priority="CRITICAL" if vitals.get("co2", 2.0) >= 4.5 else "WATCH",
                domain="env",
                title="ECLSS Closed Habitat CO2 Scrubber Inspection",
                command="Inspect Carbon Dioxide Removal Assembly (CDRA) desiccant bed cycling status. Confirm cabin air velocity exceeds 0.05 m/s to eliminate localized carbon dioxide pockets.",
                rationale="NASA HRP Evidence: Elevated CO2 partial pressure (>3.0 mmHg) in closed spacecraft environments triggers hypercapnic headaches, cognitive slowdown, and visual disturbances.",
                evidence_source="NASA HRP Hazards: Hostile Closed Environment - ECLSS Atmosphere Standards",
                hazard="Hostile Closed Environment",
            )
        )

    # Radiation Emergency (SPE)
    if res.get("spe") is not None or vitals.get("dose", 0.3) >= 5.0:
        predicted_commands.insert(
            0,
            PredictedCommand(
                priority="CRITICAL",
                domain="rad",
                title="Solar Particle Event (SPE) Radiation Shelter Relocation",
                command="Move all crew immediately into the central water-wall radiation storm shelter. Verify personal active dosimeters and monitor CSA EVARM / MOSFET sensor telemetry.",
                rationale="CSA & NASA Evidence: High-energy solar protons deliver acute ionizing radiation doses exceeding operational limits within hours, risking acute radiation syndrome and DNA double-strand breaks.",
                evidence_source="CSA Monitoring Radiation for Astronaut Health & NASA Space Radiation Hazard",
                hazard="Space Radiation",
            ),
        )

    # Nominal Fallback
    if not predicted_commands:
        predicted_commands.append(
            PredictedCommand(
                priority="ROUTINE",
                domain="car",
                title="Nominal Flight Health Maintenance Protocol",
                command="All 17 physiological and environmental markers match baseline. Maintain 120-minute daily resistive exercise regimen, 2.5L scheduled hydration, and 8h circadian rest window.",
                rationale="NASA Standard Operations: Baseline biometrics stable. Autonomous CDSS monitoring active.",
                evidence_source="NASA HRP Human Research Program Standard Flight Guidelines",
                hazard="Nominal Flight State",
            )
        )

    # 3. 7-Day Trajectory Predictions
    trajectories_7d = {}
    for k in ["temp", "hr", "fat", "ex", "grip", "co2", "slp", "sbp", "stress"]:
        if k in series and len(series[k]) >= 3:
            traj = predict_risk_trajectory(
                series=series[k][:day],
                baseline_mean=ctx.base[k]["mean"],
                baseline_sd=ctx.base[k]["sd"],
                direction=ctx.cfg["metrics"][k]["dir"],
                horizon_days=7,
            )
            trajectories_7d[k] = traj

    # 4. Evidence Citations
    evidence_citations = [
        s for s in RESEARCH_SOURCES
        if s.get("status") == "verified"
    ]

    return AssessmentResponse(
        astronaut_id=req.astronaut_id,
        mission_day=day,
        tier=tier,
        tier_label=tier_label,
        status=status_label,
        worst_domain=worst_domain,
        worst_domain_name=worst_domain_name,
        hazard=primary_hazard,
        domains=res["domains"],
        deviations=deviations,
        predicted_commands=predicted_commands,
        evidence_citations=evidence_citations,
        trajectories_7d=trajectories_7d,
        ground_summary=ground_summary(ctx, day),
        timestamp=datetime.now(timezone.utc).isoformat(),
        prototype_disclaimer="Prototype decision-support analysis grounded in NASA HRP and CSA research. Not a certified clinical medical device.",
    )


@router.get("/{astronaut_id}")
@router.post("/{astronaut_id}")
async def get_or_run_health_analysis(
    astronaut_id: str,
    day: int = Query(45, ge=1, le=180, description="Mission day to analyze"),
    include_summary: bool = Query(True, description="Include ground summary text"),
    payload: Optional[dict[str, Any]] = None,
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found in mission telemetry")

    # If payload provided with custom vitals, inject them
    if payload and "vitals" in payload and isinstance(payload["vitals"], dict):
        for k, v in payload["vitals"].items():
            if k in series and day - 1 < len(series[k]) and v is not None:
                series[k][day - 1] = v

    ctx = prepare(series)
    res = analyze(ctx, day)

    if include_summary:
        res["ground_summary"] = ground_summary(ctx, day)
    res["astronaut_id"] = astronaut_id
    res["prototype_disclaimer"] = "Prototype decision-support analysis. Not certified clinical medical diagnostic."

    return res


@router.get("/{astronaut_id}/latest")
async def get_latest_health_analysis(
    astronaut_id: str,
    include_summary: bool = Query(True, description="Include ground summary text"),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found in mission telemetry")

    ctx = prepare(series)
    latest_day = len(series.get("hr", [])) or 45
    res = analyze(ctx, latest_day)

    if include_summary:
        res["ground_summary"] = ground_summary(ctx, latest_day)
    res["astronaut_id"] = astronaut_id
    res["prototype_disclaimer"] = "Prototype decision-support analysis. Not certified clinical medical diagnostic."

    return res


@router.get("/{astronaut_id}/forecast")
async def get_health_forecast(
    astronaut_id: str,
    day: int = Query(45, ge=1, le=180),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    ctx = prepare(series)
    res = analyze(ctx, day)

    metric_trajectories = {}
    for k in ["temp", "hr", "fat", "ex", "grip", "co2", "slp"]:
        if k in series:
            traj = predict_risk_trajectory(
                series=series[k][:day],
                baseline_mean=ctx.base[k]["mean"],
                baseline_sd=ctx.base[k]["sd"],
                direction=ctx.cfg["metrics"][k]["dir"],
                horizon_days=7,
            )
            metric_trajectories[k] = traj

    return {
        "astronaut_id": astronaut_id,
        "day": day,
        "linear_forecast": res.get("forecast"),
        "7_day_metric_trajectories": metric_trajectories,
    }


@router.get("/{astronaut_id}/history")
async def get_analysis_history(
    astronaut_id: str,
    from_day: int = Query(1, ge=1, le=180),
    to_day: int = Query(45, ge=1, le=180),
):
    series = load_mission_telemetry(astronaut_id)
    if not series:
        raise HTTPException(status_code=404, detail=f"Astronaut {astronaut_id} not found")

    ctx = prepare(series)
    history = []
    for d in range(from_day, to_day + 1):
        res = analyze(ctx, d)
        history.append({
            "day": d,
            "tier": res["overall"]["tier"],
            "status": res["overall"]["status"],
            "worst_domain": res["overall"]["worstDomain"],
            "cum_dose": round(res["cumDose"], 1),
            "spe_active": res["spe"] is not None,
        })

    return {"astronaut_id": astronaut_id, "history": history}
