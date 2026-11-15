from __future__ import annotations

from typing import Any, Optional


def validate_metric_range(metric_key: str, value: Optional[float]) -> tuple[bool, str]:
    """Validate physiological plausibility ranges."""
    if value is None:
        return True, "OK"

    ranges = {
        "hr": (30, 220),
        "hrv": (5, 250),
        "spo2": (50, 100),
        "sbp": (70, 240),
        "dbp": (40, 150),
        "temp": (34.0, 42.5),
        "slp": (0, 24),
        "fat": (0, 10),
        "ex": (0, 300),
        "grip": (5, 100),
        "nutrition": (0, 10),
        "hydration": (0, 25),
        "mood": (0, 10),
        "stress": (0, 10),
        "headache": (0, 10),
        "co2": (0.0, 25.0),
        "dose": (0.0, 150.0),
    }

    if metric_key in ranges:
        lo, hi = ranges[metric_key]
        if value < lo or value > hi:
            return False, f"Value {value} out of plausible physiological bounds [{lo}, {hi}] for {metric_key}"

    return True, "OK"
