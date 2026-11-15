from __future__ import annotations

import re
from typing import Optional


def sanitize_text(text: str) -> str:
    """Sanitize and clean text extracted from external sources."""
    if not text:
        return ""
    # Remove HTML tags if any remain
    cleaned = re.sub(r"<[^>]+>", " ", text)
    # Collapse multiple whitespaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_key_sentences(text: str, keywords: list[str], max_sentences: int = 3) -> list[str]:
    """Extract sentences containing specific spaceflight medical keywords."""
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?]) +", text)
    matched = []
    lower_kws = [k.lower() for k in keywords]
    for s in sentences:
        s_clean = s.strip()
        if any(kw in s_clean.lower() for kw in lower_kws):
            matched.append(s_clean)
            if len(matched) >= max_sentences:
                break
    return matched
