from __future__ import annotations

import json
import math
import os
from typing import Any, Optional

# Metrics configuration matching web/config.js exactly
METRICS_CONFIG = {
    "temp":      {"name": "Resting temperature",   "unit": "°C",      "domain": "imm", "dir": 1,  "sd": 0.15, "dec": 2},
    "fat":       {"name": "Fatigue",               "unit": "/10",     "domain": "imm", "dir": 1,  "sd": 0.6,  "dec": 1},
    "hr":        {"name": "Resting heart rate",    "unit": "bpm",     "domain": "car", "dir": 1,  "sd": 2.0,  "dec": 0},
    "hrv":       {"name": "HRV",                   "unit": "ms",      "domain": "car", "dir": -1, "sd": 5.0,  "dec": 0},
    "spo2":      {"name": "Blood oxygen (SpO2)",   "unit": "%",       "domain": "car", "dir": -1, "sd": 0.8,  "dec": 1},
    "sbp":       {"name": "Blood pressure (sys)",  "unit": "mmHg",    "domain": "car", "dir": 1,  "sd": 8.0,  "dec": 0},
    "dbp":       {"name": "Blood pressure (dia)",  "unit": "mmHg",    "domain": "car", "dir": 1,  "sd": 5.0,  "dec": 0},
    "ex":        {"name": "Exercise",              "unit": "min",     "domain": "msk", "dir": -1, "sd": 12.0, "dec": 0},
    "grip":      {"name": "Grip strength",         "unit": "kg",      "domain": "msk", "dir": -1, "sd": 1.0,  "dec": 1},
    "nutrition": {"name": "Nutrition score",       "unit": "/10",     "domain": "msk", "dir": -1, "sd": 1.0,  "dec": 1},
    "slp":       {"name": "Sleep",                 "unit": "h",       "domain": "beh", "dir": -1, "sd": 0.5,  "dec": 1},
    "mood":      {"name": "Mood",                  "unit": "/10",     "domain": "beh", "dir": -1, "sd": 0.6,  "dec": 1},
    "stress":    {"name": "Stress",                "unit": "/10",     "domain": "beh", "dir": 1,  "sd": 0.6,  "dec": 1},
    "headache":  {"name": "Headache severity",     "unit": "/10",     "domain": "beh", "dir": 1,  "sd": 0.8,  "dec": 1},
    "hydration": {"name": "Hydration",             "unit": "glasses", "domain": "imm", "dir": -1, "sd": 1.5,  "dec": 1},
    "co2":       {"name": "Cabin CO2",             "unit": "mmHg",    "domain": "env", "dir": 1,  "sd": 0.3,  "dec": 1},
    "dose":      {"name": "Radiation dose",        "unit": "mSv/day", "domain": "rad", "dir": 1,  "sd": 0.1,  "dec": 2},
}

DOMAINS = {
    "imm": "Immune",
    "msk": "Bone and muscle",
    "car": "Heart",
    "beh": "Mind and mood",
    "env": "Habitat air",
    "rad": "Radiation",
}

LEARNING = -1


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def mean(a: list[float]) -> float:
    return sum(a) / len(a) if a else 0.0


def std(a: list[float], m: float) -> float:
    if len(a) < 2:
        return 0.0
    return math.sqrt(sum((x - m) ** 2 for x in a) / len(a))


class EngineContext:
    def __init__(self, series: dict, base: dict, drift: dict, cum: list, cfg: dict):
        self.series = series
        self.base = base
        self.drift = drift
        self.cum = cum
        self.cfg = cfg


def prepare(series: dict, cfg: Optional[dict] = None) -> EngineContext:
    if cfg is None:
        cfg = {
            "days": 180,
            "adaptationDays": 7,
            "baseline": {"start": 8, "end": 30},
            "ewmaLambda": 0.3,
            "amber": 1.3,
            "red": 2.3,
            "persistence": 2,
            "sdFloor": 0.6,
            "immuneTightFactor": 0.75,
            "radiation": {
                "missionLimitmSv": 1000,
                "speDoseThreshold": 5,
                "speActiveDays": 2,
                "speWatchDays": 14,
                "cumulativeWatchFraction": 0.5,
            },
            "forecast": {"windowDays": 5, "minSlope": 0.12, "minDrift": 0.5, "maxHorizonDays": 10},
            "metrics": METRICS_CONFIG,
            "domains": DOMAINS,
        }

    base = {}
    drift = {}
    days = cfg.get("days", 180)

    for k in cfg["metrics"]:
        if k not in series or not series[k]:
            series[k] = [None] * days

        vals = []
        b_start = cfg["baseline"]["start"]
        b_end = min(cfg["baseline"]["end"], len(series[k]))
        for d in range(b_start, b_end + 1):
            v = series[k][d - 1]
            if v is not None:
                vals.append(v)

        m = mean(vals) if vals else 0.0
        s = max(std(vals, m) if len(vals) > 1 else cfg["metrics"][k]["sd"], cfg["metrics"][k]["sd"] * cfg["sdFloor"])
        base[k] = {"mean": m, "sd": s}

        e = 0.0
        drift[k] = []
        for d in range(1, days + 1):
            v = series[k][d - 1] if d - 1 < len(series[k]) else None
            if v is not None and d >= cfg["baseline"]["start"]:
                z = clamp(((v - m) / s) * cfg["metrics"][k]["dir"], -6.0, 6.0)
                e = cfg["ewmaLambda"] * z + (1.0 - cfg["ewmaLambda"]) * e
            drift[k].append(e)

    cum = []
    c = 0.0
    for d in range(1, days + 1):
        v = series.get("dose", [])[d - 1] if d - 1 < len(series.get("dose", [])) else None
        c += v if v is not None else base["dose"]["mean"]
        cum.append(c)

    return EngineContext(series, base, drift, cum, cfg)


def drift_at(ctx: EngineContext, k: str, d: int) -> float:
    idx = max(0, min(len(ctx.drift[k]) - 1, d - 1))
    return ctx.drift[k][idx]


def recent_spe(ctx: EngineContext, t: int, w: int) -> int:
    th = ctx.cfg["radiation"]["speDoseThreshold"]
    for d in range(max(1, t - w), t + 1):
        idx = d - 1
        if idx < len(ctx.series.get("dose", [])):
            v = ctx.series["dose"][idx]
            if v is not None and v > th:
                return d
    return 0


def get_level(ctx: EngineContext, k: str, d: int, tight: bool) -> int:
    e = drift_at(ctx, k, d)
    f = ctx.cfg["immuneTightFactor"] if tight else 1.0
    if e >= ctx.cfg["red"] * f:
        return 2
    if e >= ctx.cfg["amber"] * f:
        return 1
    return 0


def sustained(ctx: EngineContext, k: str, t: int, tight: bool) -> int:
    lv = 2
    for p in range(ctx.cfg["persistence"]):
        lv = min(lv, get_level(ctx, k, max(1, t - p), tight))
    return lv


def format_value(cfg: dict, k: str, v: Optional[float]) -> str:
    if v is None:
        return "no data"
    dec = cfg["metrics"][k]["dec"]
    unit = cfg["metrics"][k]["unit"]
    return f"{v:.{dec}f} {unit}"


def last_value(ctx: EngineContext, k: str, t: int) -> Optional[float]:
    for d in range(t, 0, -1):
        idx = d - 1
        if idx < len(ctx.series[k]) and ctx.series[k][idx] is not None:
            return ctx.series[k][idx]
    return None


def forecast(ctx: EngineContext, t: int) -> Optional[dict]:
    F = ctx.cfg["forecast"]
    if t <= F["windowDays"] + ctx.cfg["baseline"]["start"]:
        return None
    best = None
    for k in ctx.cfg["metrics"]:
        if k == "dose":
            continue
        e = drift_at(ctx, k, t)
        prev_e = drift_at(ctx, k, t - F["windowDays"])
        slope = (e - prev_e) / F["windowDays"]
        if e >= F["minDrift"] and e < ctx.cfg["amber"] and slope > F["minSlope"]:
            days = max(1, round((ctx.cfg["amber"] - e) / slope))
            if days <= F["maxHorizonDays"] and (best is None or days < best["days"]):
                best = {"key": k, "name": ctx.cfg["metrics"][k]["name"], "days": days}
    return best


def analyze(ctx: EngineContext, t: int) -> dict:
    cfg = ctx.cfg
    R = cfg["radiation"]
    adapting = t <= cfg["adaptationDays"]
    spe14 = recent_spe(ctx, t, R["speWatchDays"])
    speNow = recent_spe(ctx, t, R["speActiveDays"] - 1)
    domains = {}

    for dm in cfg["domains"]:
        tight = (dm == "imm" and spe14 > 0)
        indicators = []
        status = 0
        have = 0
        total = 0
        score = 0.0

        for k in cfg["metrics"]:
            if cfg["metrics"][k]["domain"] != dm:
                continue
            for q in range(max(1, t - 6), t + 1):
                total += 1
                idx = q - 1
                if idx < len(ctx.series[k]) and ctx.series[k][idx] is not None:
                    have += 1

            lv = 0 if adapting else sustained(ctx, k, t, tight)
            status = max(status, lv)
            current_drift = drift_at(ctx, k, t)
            score = max(score, current_drift)
            indicators.append({
                "key": k,
                "name": cfg["metrics"][k]["name"],
                "value": last_value(ctx, k, t),
                "baseline": ctx.base[k]["mean"],
                "drift": current_drift,
                "level": lv,
            })

        indicators.sort(key=lambda x: x["drift"], reverse=True)
        confidence = (have / total) if total > 0 else 1.0
        domains[dm] = {
            "status": LEARNING if adapting else status,
            "score": score,
            "indicators": indicators,
            "confidence": confidence,
            "rule": None,
        }

    contributors = []
    def lv_func(metric_key: str) -> int:
        if adapting:
            return 0
        tight_flag = (spe14 > 0) if metric_key in ("temp", "fat") else False
        return sustained(ctx, metric_key, t, tight_flag)

    if not adapting:
        if lv_func("temp") >= 1 and (lv_func("fat") >= 1 or lv_func("hr") >= 1 or lv_func("slp") >= 1):
            contributors.append({
                "domain": "imm",
                "text": "Infection pattern: temperature is up together with fatigue, heart rate or poor sleep."
            })
            domains["imm"]["status"] = 2
            domains["imm"]["rule"] = "infection"

        if lv_func("co2") >= 1 and (lv_func("mood") >= 1 or lv_func("slp") >= 1 or lv_func("stress") >= 1):
            contributors.append({
                "domain": "env",
                "text": "Habitat pattern: raised CO2 with worse sleep or mood. Check the air before blaming health."
            })
            domains["env"]["status"] = 2
            domains["env"]["rule"] = "habitat"

        if lv_func("ex") >= 1 and lv_func("grip") >= 1:
            contributors.append({
                "domain": "msk",
                "text": "Exercise is below target and grip is falling: bone and muscle loading is slipping."
            })
        elif lv_func("ex") >= 1:
            contributors.append({
                "domain": "msk",
                "text": "Exercise is below target. Bone and muscle loss builds quietly."
            })

        if speNow:
            domains["rad"]["status"] = 2
            domains["rad"]["rule"] = "spe"
        elif spe14:
            domains["rad"]["status"] = 1
            contributors.append({
                "domain": "imm",
                "text": "Solar particle event in the last 14 days: immune thresholds are tighter."
            })
        elif (ctx.cum[t - 1] / R["missionLimitmSv"]) > R["cumulativeWatchFraction"]:
            domains["rad"]["status"] = 1

    sts = [max(0, d["status"]) for d in domains.values()]
    worst = max(sts) if sts else 0
    act_count = sum(1 for s in sts if s == 2)
    worst_domain = sorted(
        domains.keys(),
        key=lambda dm: (max(0, domains[dm]["status"]), domains[dm]["score"]),
        reverse=True
    )[0]

    tier = 0
    if not adapting:
        if act_count >= 2 or any(d["rule"] in ("infection", "spe") for d in domains.values()):
            tier = 3
        elif worst == 2:
            tier = 2
        elif worst == 1:
            tier = 1

    spe_obj = None
    if speNow:
        idx = speNow - 1
        dose_val = ctx.series["dose"][idx] if idx < len(ctx.series["dose"]) else None
        spe_obj = {"day": speNow, "dose": dose_val or 0.0}

    cum_val = ctx.cum[t - 1] if t - 1 < len(ctx.cum) else ctx.cum[-1] if ctx.cum else 0.0

    return {
        "day": t,
        "adapting": adapting,
        "domains": domains,
        "contributors": contributors,
        "forecast": None if adapting else forecast(ctx, t),
        "overall": {
            "status": LEARNING if adapting else worst,
            "tier": tier,
            "worstDomain": worst_domain,
        },
        "spe": spe_obj,
        "cumDose": cum_val,
    }


def ground_summary(ctx: EngineContext, t: int) -> str:
    cfg = ctx.cfg
    a = analyze(ctx, t)
    L = ["Normal", "Watch", "Act"]
    s = f"MISSION VITALS GROUND SUMMARY (simulated data)\nMission day {t} of {cfg['days']}. Escalation tier: {a['overall']['tier']}\n\n"
    for dm in cfg["domains"]:
        st = a["domains"][dm]["status"]
        status_label = "Learning baseline" if st == LEARNING else L[st]
        s += f"{cfg['domains'][dm]}: {status_label}\n"
        for i in a["domains"][dm]["indicators"]:
            if i["drift"] >= 0.5:
                formatted = format_value(cfg, i["key"], i["value"])
                base_dec = cfg["metrics"][i["key"]]["dec"]
                s += f"  - {i['name']} {formatted} vs your usual {i['baseline']:.{base_dec}f}, drift {i['drift']:.1f}\n"

    s += "\nContributing patterns:\n"
    if a["contributors"]:
        s += "\n".join(f"  - {c['text']}" for c in a["contributors"])
    else:
        s += "  none"

    s += "\n\nLast 14 days (daily values, - = not logged):\n"
    for k in ["temp", "hr", "slp", "fat", "mood", "ex", "co2", "dose"]:
        row = []
        for d in range(max(1, t - 13), t + 1):
            idx = d - 1
            v = ctx.series[k][idx] if idx < len(ctx.series[k]) else None
            row.append("-" if v is None else f"{v:.1f}")
        s += f"  {cfg['metrics'][k]['name']} ({cfg['metrics'][k]['unit']}): {', '.join(row)}\n"

    s += f"\nCumulative radiation: {a['cumDose']:.0f} of {cfg['radiation']['missionLimitmSv']} mSv.\nDecision support only, not a diagnosis."
    return s


def load_mission_telemetry(astronaut_id: str = "ASTRO-1") -> dict:
    # Resolve mission.json path
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    json_path = os.path.join(base_dir, "web", "data", "mission.json")
    if not os.path.exists(json_path):
        json_path = os.path.join("c:\\NasaHackathon-master", "web", "data", "mission.json")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # If data has a top-level series (as in standard mission.json), return that
    if "series" in data:
        return data["series"]

    # Otherwise search in astronauts array
    for a in data.get("astronauts", []):
        if a.get("id") == astronaut_id:
            return a.get("series", {})

    if data.get("astronauts"):
        return data["astronauts"][0].get("series", {})
    return {}
