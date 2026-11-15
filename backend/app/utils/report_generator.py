from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional


def format_clinical_markdown_report(report_data: dict) -> str:
    """Format structured report data into high-visibility Markdown report."""
    md = []
    md.append(f"# ASTRA CRITICAL MEDICAL ESCALATION")
    md.append(f"**Report Reference:** `{report_data.get('report_id', 'N/A')}`")
    md.append(f"**Timestamp:** `{report_data.get('timestamp', datetime.now(timezone.utc).isoformat())}`")
    md.append(f"**Astronaut ID:** `{report_data.get('astronaut_id', 'ASTRO-1')}` | **Mission Day:** `{report_data.get('mission_day', 1)}`")
    md.append(f"**Escalation Tier:** `TIER {report_data.get('escalation_tier', 3)}` ({report_data.get('tier_classification', 'CRITICAL')})")
    md.append("")
    md.append(f"## Clinical Assessment")
    md.append(f"{report_data.get('alert_message', 'No diagnostic message available.')}")
    md.append("")
    md.append(f"## Contributing Systemic Patterns")
    patterns = report_data.get("contributing_patterns", [])
    if patterns:
        for p in patterns:
            md.append(f"- {p}")
    else:
        md.append("- No cross-domain synergy patterns identified.")
    md.append("")
    md.append(f"## Prescribed Crew Actions")
    actions = report_data.get("recommended_actions", [])
    for i, a in enumerate(actions):
        md.append(f"{i+1}. {a}")
    md.append("")
    md.append(f"## NASA / CSA Research Reference")
    ev = report_data.get("evidence_summary", {})
    if ev:
        md.append(f"> **Finding:** {ev.get('finding', 'N/A')}")
        md.append(f"> **Source:** [{ev.get('agency', 'Agency')} - {ev.get('source_title', 'Ref')}]({ev.get('source_url', '#')})")
    md.append("")
    md.append(f"---")
    md.append(f"*{report_data.get('disclaimer', 'Prototype decision-support system only.')}*")
    return "\n".join(md)
