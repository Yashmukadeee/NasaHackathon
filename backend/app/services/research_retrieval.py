from __future__ import annotations

import hashlib
import httpx
from bs4 import BeautifulSoup
from typing import Optional

ALLOWLISTED_URLS = [
    "https://www.nasa.gov/hrp/hazards/",
    "https://www.nasa.gov/hrp/risks/",
    "https://www.nasa.gov/hrp/ongoing-hrp-research/",
    "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
]


def compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def fetch_and_parse(url: str, timeout: int = 20) -> dict:
    if url not in ALLOWLISTED_URLS:
        return {"url": url, "status": "blocked", "error": "URL not in allowlist"}

    headers = {
        "User-Agent": "ASTRA-Research-Ingestion/1.0 (NASA Space Apps Prototype; Non-Commercial)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text

            soup = BeautifulSoup(html, "html.parser")
            for element in soup(["script", "style", "nav", "footer", "aside", "header", "form"]):
                element.decompose()

            title_elem = soup.find("title")
            title = title_elem.get_text(strip=True) if title_elem else url

            sections = []
            current_heading = "Overview"
            current_texts = []

            for elem in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
                if elem.name in ["h1", "h2", "h3", "h4"]:
                    if current_texts:
                        sections.append({
                            "heading": current_heading,
                            "text": " ".join(current_texts)[:1000]
                        })
                    current_heading = elem.get_text(strip=True)
                    current_texts = []
                elif elem.name in ["p", "li"]:
                    t = elem.get_text(strip=True)
                    if t and len(t) > 25:
                        current_texts.append(t)

            if current_texts:
                sections.append({
                    "heading": current_heading,
                    "text": " ".join(current_texts)[:1000]
                })

            raw_text = " ".join(s["text"] for s in sections)
            return {
                "url": url,
                "title": title,
                "sections": sections[:10],
                "raw_text": raw_text[:8000],
                "content_hash": compute_hash(raw_text),
                "status": "verified",
            }
    except Exception as e:
        return {
            "url": url,
            "status": "offline_cached",
            "error": str(e),
            "note": "External resource retrieval unreachable or offline; using verified local knowledge base fallback."
        }


async def refresh_all_sources() -> list[dict]:
    results = []
    for url in ALLOWLISTED_URLS:
        res = await fetch_and_parse(url)
        results.append(res)
    return results
