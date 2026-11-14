#!/usr/bin/env python3
"""Mission Vitals: simulated astronaut data generator.

Produces a 180-day mission as JSON (column format, index 0 = day 1).
Scripted anomalies are the ground truth used by eval/evaluate.mjs.

Usage:
  python3 simulator/simulate.py --out web/data/mission.json
  python3 simulator/simulate.py --seed 7 --no-anomalies --out /tmp/healthy.json
  python3 simulator/simulate.py --all      # main demo file + evaluation sets
"""
import argparse, json, os, random

DAYS = 180

# key: (baseline, noise sd, probability a reading is missing)
METRICS = {
    "temp":   (36.6, 0.15, 0.04),
    "fat":    (3.0, 0.6, 0.12),
    "hr":     (62.0, 2.0, 0.04),
    "hrv":    (58.0, 5.0, 0.04),
    "ex":     (110.0, 12.0, 0.04),
    "grip":   (40.0, 1.0, 0.12),
    "slp":    (7.2, 0.5, 0.04),
    "mood":   (7.0, 0.6, 0.12),
    "stress": (3.0, 0.6, 0.12),
    "co2":    (3.0, 0.3, 0.0),
    "dose":   (1.8, 0.1, 0.0),
}

# Ground truth: name, expected domain, first day, last day
ANOMALIES = [
    {"name": "infection", "domain": "imm", "start": 62, "end": 76},
    {"name": "co2_spike", "domain": "env", "start": 90, "end": 96},
    {"name": "bone_loading_drop", "domain": "msk", "start": 100, "end": 140},
    {"name": "solar_particle_event", "domain": "rad", "start": 120, "end": 121},
    {"name": "mood_decline", "domain": "beh", "start": 150, "end": 180},
]


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def generate(seed=42, anomalies=True):
    rng = random.Random(seed)
    series = {k: [] for k in METRICS}
    for d in range(1, DAYS + 1):
        g = lambda: rng.gauss(0, 1)
        adapt = (1 - d / 7) if d <= 7 else 0.0          # microgravity adaptation
        f = co = b = md = 0.0
        spike = 0.0
        if anomalies:
            if 62 <= d <= 72: f = min(1.0, (d - 61) / 10)
            elif 72 < d <= 77: f = max(0.0, 1 - (d - 72) / 5)
            if 90 <= d <= 96: co = 1.0
            if 100 <= d <= 140: b = min(1.0, (d - 99) / 6)
            elif 140 < d <= 150: b = max(0.0, 1 - (d - 140) / 10)
            if d == 120: spike = 28.0
            if d == 121: spike = 12.0
            if d >= 150: md = d - 149
        post_spe = 1.0 if anomalies and 121 <= d <= 135 else 0.0
        grip_loss = 0.06 * max(0, min(d, 140) - 99) if anomalies else 0.0
        v = {
            "temp": 36.6 + 0.15 * g() + 0.9 * f,
            "fat": 3 + 0.6 * g() + 3 * f + adapt + post_spe,
            "hr": 62 + 2 * g() + 7 * f + 4 * adapt,
            "hrv": 58 + 5 * g() - 12 * f,
            "ex": 110 + 12 * g() - 55 * b,
            "grip": 40 + g() - grip_loss,
            "slp": 7.2 + 0.5 * g() - 1.5 * f - 0.6 * adapt - 0.8 * co,
            "mood": 7 + 0.6 * g() - 1.2 * co - 0.04 * md,
            "stress": 3 + 0.6 * g() + 1.2 * co + 0.03 * md + f,
            "co2": 3 + 0.3 * g() + 3.5 * co,
            "dose": 1.8 + 0.1 * g() + spike,
        }
        for k, (_, _, miss) in METRICS.items():
            missing = d > 1 and rng.random() < miss
            val = None if missing else round(v[k], 3)
            if val is not None and k in ("fat", "mood", "stress"):
                val = round(clamp(val, 0, 10), 2)
            series[k].append(val)
    return {
        "meta": {"seed": seed, "days": DAYS, "simulated": True,
                 "anomalies": ANOMALIES if anomalies else []},
        "series": series,
    }


def write(path, obj):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":"))
    print("wrote", path)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-anomalies", action="store_true")
    ap.add_argument("--out", default="web/data/mission.json")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    if a.all:
        write("web/data/mission.json", generate(42, True))
        for s in range(1, 21):
            write(f"web/data/eval/anomalous_{s}.json", generate(s, True))
            write(f"web/data/eval/healthy_{s}.json", generate(100 + s, False))
    else:
        write(a.out, generate(a.seed, not a.no_anomalies))
