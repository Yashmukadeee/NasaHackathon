from __future__ import annotations

from typing import Optional
import numpy as np


def forecast_days_to_amber(
    drift_series: list[float],
    amber: float = 1.3,
    window: int = 5,
    min_slope: float = 0.12,
    min_drift: float = 0.5,
    max_horizon: int = 10,
) -> Optional[dict]:
    """
    Given a drift (EWMA z-score) series, forecast days until Watch threshold.
    Returns {"days": int, "slope": float} or None if no imminent crossing.
    """
    if len(drift_series) < window + 1:
        return None

    current = drift_series[-1]
    prev = drift_series[-1 - window]
    slope = (current - prev) / window

    if current >= min_drift and current < amber and slope > min_slope:
        days = max(1, round((amber - current) / slope))
        if days <= max_horizon:
            return {"days": int(days), "slope": float(slope)}
    return None


def predict_risk_trajectory(
    series: list[Optional[float]],
    baseline_mean: float,
    baseline_sd: float,
    direction: int = 1,
    horizon_days: int = 7,
) -> dict:
    """
    Project metric trajectory over horizon_days using recent slope.
    """
    valid = [(i, v) for i, v in enumerate(series) if v is not None]
    if len(valid) < 3:
        current_val = valid[-1][1] if valid else baseline_mean
        return {
            "projected_value": current_val,
            "projected_zscore": 0.0,
            "trend": "stable",
        }

    xs = [x for x, _ in valid[-14:]]
    ys = [y for _, y in valid[-14:]]
    p = np.polyfit(xs, ys, 1)
    slope = p[0]

    last_x = xs[-1]
    last_y = ys[-1]
    projected_val = float(last_y + slope * horizon_days)
    sd = baseline_sd if baseline_sd > 0 else 1.0
    projected_z = float(direction * (projected_val - baseline_mean) / sd)

    trend = "stable"
    if direction * slope > 0.05 * sd:
        trend = "worsening"
    elif direction * slope < -0.05 * sd:
        trend = "improving"

    return {
        "projected_value": projected_val,
        "projected_zscore": projected_z,
        "trend": trend,
    }
