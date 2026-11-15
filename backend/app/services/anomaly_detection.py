from __future__ import annotations

from typing import Optional
import numpy as np
from scipy import stats


def compute_zscore(value: float, mean_val: float, sd_val: float, direction: int = 1) -> float:
    """Directional z-score where positive represents worsening condition."""
    if sd_val <= 0:
        return 0.0
    return float(direction * (value - mean_val) / sd_val)


def detect_outliers_zscore(series: list[Optional[float]], threshold: float = 2.5) -> list[int]:
    """Return indices of values where directional |z-score| exceeds threshold."""
    valid_pts = [(i, v) for i, v in enumerate(series) if v is not None]
    if len(valid_pts) < 4:
        return []
    vals = np.array([v for _, v in valid_pts])
    m = np.mean(vals)
    s = np.std(vals)
    if s == 0:
        return []
    outliers = []
    for i, v in valid_pts:
        if abs((v - m) / s) >= threshold:
            outliers.append(i)
    return outliers


def compute_ewma(series: list[Optional[float]], lam: float = 0.3) -> list[float]:
    """Exponentially weighted moving average of input series."""
    res = []
    e = 0.0
    for v in series:
        if v is not None:
            e = lam * v + (1.0 - lam) * e
        res.append(e)
    return res


def trend_slope(series: list[Optional[float]], window: int = 7) -> float:
    """Linear regression slope over the last `window` non-null data points."""
    valid = [(i, v) for i, v in enumerate(series[-window:]) if v is not None]
    if len(valid) < 3:
        return 0.0
    xs = np.array([x for x, _ in valid], dtype=float)
    ys = np.array([y for _, y in valid], dtype=float)
    try:
        slope, _, _, _, _ = stats.linregress(xs, ys)
        return float(slope)
    except Exception:
        return 0.0
