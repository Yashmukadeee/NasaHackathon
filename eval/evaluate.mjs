// Evaluation against simulator ground truth: detection latency, sensitivity, false alarms.
import { readFileSync, writeFileSync } from "node:fs";
import { prepare, analyze } from "../web/engine.js";
import { CONFIG } from "../web/config.js";

const load = (p) => JSON.parse(readFileSync(new URL(`../web/data/eval/${p}.json`, import.meta.url)));

/** Number of times a domain newly turns Watch/Act after the adaptation window. */
export function alertEpisodes(series) {
  const ctx = prepare(series), prev = {};
  let n = 0;
  for (let d = CONFIG.adaptationDays + 1; d <= CONFIG.days; d++) {
    const a = analyze(ctx, d);
    for (const dm in a.domains) {
      const on = a.domains[dm].status >= 1;
      if (on && !prev[dm]) n++;
      prev[dm] = on;
    }
  }
  return n;
}

export function latency(series, an) {
  const ctx = prepare(series);
  for (let d = an.start; d <= Math.min(CONFIG.days, an.end + 10); d++)
    if (analyze(ctx, d).domains[an.domain].status >= 1) return d - an.start;
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runs = 20, anomalies = load("anomalous_1").meta.anomalies;
  let fa = 0;
  for (let s = 1; s <= runs; s++) fa += alertEpisodes(load(`healthy_${s}`).series);
  const faPer30 = fa / runs / ((CONFIG.days - CONFIG.adaptationDays) / 30);

  let md = `# Evaluation\n\nSettings: amber ${CONFIG.amber}, red ${CONFIG.red}, persistence ${CONFIG.persistence} days, EWMA lambda ${CONFIG.ewmaLambda}.\n\n`;
  md += `False alarms on healthy-only missions: **${faPer30.toFixed(2)} per 30 days** (${runs} runs, all domains).\n\n`;
  md += "| Scenario | Detected | Median latency (days) | Worst latency |\n|---|---|---|---|\n";
  for (const an of anomalies) {
    const lat = [];
    let hit = 0;
    for (let s = 1; s <= runs; s++) {
      const l = latency(load(`anomalous_${s}`).series, an);
      if (l != null) { hit++; lat.push(l); }
    }
    lat.sort((a, b) => a - b);
    md += `| ${an.name} | ${hit}/${runs} | ${lat.length ? lat[Math.floor(lat.length / 2)] : "-"} | ${lat.length ? lat[lat.length - 1] : "-"} |\n`;
  }
  console.log(md);
  writeFileSync(new URL("../docs/evaluation.md", import.meta.url), md);
}
