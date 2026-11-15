from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("astra.normalizer")

# Standard clinical canonical units used across ASTRA
CANONICAL_UNITS = {
    "hr": "bpm",
    "hrv": "ms",
    "spo2": "%",
    "temp": "°C",
    "sbp": "mmHg",
    "dbp": "mmHg",
    "ex": "min",
    "grip": "kg",
    "nutrition": "/10",
    "slp": "h",
    "mood": "/10",
    "stress": "/10",
    "headache": "/10",
    "hydration": "glasses",
    "fat": "/10",
    "co2": "mmHg",
    "dose": "mSv/day",
}

# Plausible human biological limits in spaceflight
BIOLOGICAL_LIMITS = {
    "hr": (30.0, 220.0),
    "hrv": (5.0, 250.0),
    "spo2": (50.0, 100.0),
    "temp": (34.0, 42.5),
    "sbp": (60.0, 240.0),
    "dbp": (40.0, 150.0),
    "ex": (0.0, 360.0),
    "grip": (5.0, 100.0),
    "dose": (0.0, 150.0),
}


class TelemetryNormalizer:
    @classmethod
    def normalize(cls, raw_dict: dict[str, Any]) -> tuple[dict[str, float], dict[str, str], dict[str, str]]:
        """
        Normalize a dictionary of {metric: value}.
        Returns: (normalized_values, canonical_units, anomaly_flags)
        """
        normalized_vals: dict[str, float] = {}
        units: dict[str, str] = {}
        flags: dict[str, str] = {}

        for m, v in raw_dict.items():
            metric = m.lower().strip()
            try:
                val = float(v)
            except (ValueError, TypeError):
                flags[metric] = f"INVALID_NUMERIC: {v}"
                continue

            # Auto-detect Fahrenheit for temperature
            if metric == "temp" and val > 45.0:
                val = (val - 32.0) * 5.0 / 9.0

            if metric in BIOLOGICAL_LIMITS:
                lo, hi = BIOLOGICAL_LIMITS[metric]
                if val < lo or val > hi:
                    flags[metric] = f"OUT_OF_BOUNDS [{lo}, {hi}]"

            normalized_vals[metric] = round(val, 2)
            units[metric] = CANONICAL_UNITS.get(metric, "")

        return normalized_vals, units, flags

    @staticmethod
    def normalize_reading(raw: dict[str, Any]) -> tuple[bool, Optional[dict[str, Any]], str]:
        """
        Validate, normalize units, and enforce schema on an incoming sensor packet.
        Returns: (is_valid, normalized_dict, error_message)
        """
        metric = raw.get("metric_name", "").lower().strip()
        if not metric:
            return False, None, "Missing 'metric_name'"

        raw_val = raw.get("metric_value")
        if raw_val is None:
            return False, None, f"Missing 'metric_value' for metric {metric}"

        try:
            val = float(raw_val)
        except (ValueError, TypeError):
            return False, None, f"Invalid numeric value '{raw_val}' for metric {metric}"

        raw_unit = str(raw.get("unit", "")).strip().lower()

        # Unit Conversion: Fahrenheit -> Celsius
        if metric == "temp" and raw_unit in ("f", "fahrenheit", "°f"):
            val = (val - 32.0) * 5.0 / 9.0
            raw_unit = "°c"

        # Unit Conversion: kPa -> mmHg
        if metric in ("sbp", "dbp", "co2") and raw_unit in ("kpa", "kilopascal"):
            val = val * 7.50062
            raw_unit = "mmhg"

        # Unit Conversion: Seconds -> Hours for sleep
        if metric == "slp" and raw_unit in ("s", "sec", "seconds"):
            val = val / 3600.0
            raw_unit = "h"

        # Biological bounds validation
        if metric in BIOLOGICAL_LIMITS:
            lo, hi = BIOLOGICAL_LIMITS[metric]
            if val < lo or val > hi:
                return False, None, f"Metric '{metric}' value {val} out of plausible bounds [{lo}, {hi}]"

        # Timestamp normalization to ISO-8601 UTC
        raw_ts = raw.get("timestamp")
        if isinstance(raw_ts, datetime):
            ts_str = raw_ts.astimezone(timezone.utc).isoformat()
        elif isinstance(raw_ts, str) and raw_ts:
            try:
                # Ensure valid parseable timestamp
                dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
                ts_str = dt.astimezone(timezone.utc).isoformat()
            except ValueError:
                ts_str = datetime.now(timezone.utc).isoformat()
        else:
            ts_str = datetime.now(timezone.utc).isoformat()

        # Normalize signal quality (0.0 to 1.0)
        sig_q = raw.get("signal_quality", 1.0)
        try:
            sig_q = max(0.0, min(1.0, float(sig_q)))
        except (ValueError, TypeError):
            sig_q = 1.0

        canonical_unit = CANONICAL_UNITS.get(metric, raw.get("unit", ""))

        normalized = {
            "astronaut_id": str(raw.get("astronaut_id", "ASTRO-1")),
            "device_id": str(raw.get("device_id", "UNKNOWN_DEV")),
            "sequence_number": int(raw.get("sequence_number", 0)),
            "timestamp": ts_str,
            "metric_name": metric,
            "metric_value": round(val, 3),
            "unit": canonical_unit,
            "signal_quality": round(sig_q, 2),
            "device_source": str(raw.get("device_source", "wearable_ble")),
            "measurement_provenance": raw.get("measurement_provenance", {
                "normalized": True,
                "ingestion_utc": datetime.now(timezone.utc).isoformat()
            }),
        }

        return True, normalized, "OK"
