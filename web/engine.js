// Mission Vitals analysis engine. Pure functions, no DOM, runs in browser and Node.
// Method: personal baseline -> z-score -> EWMA drift -> persistence -> domain status
// -> rules layer -> contributors -> forecast. No trained model, by design.
import { CONFIG } from "./config.js";

export const LEARNING = -1; // status during the adaptation window
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mean = (a) => a.reduce((p, c) => p + c, 0) / a.length;
const std = (a, m) => Math.sqrt(a.reduce((p, c) => p + (c - m) ** 2, 0) / a.length);

/** Build baselines, EWMA drift series and cumulative dose for a mission. */
export function prepare(series, cfg = CONFIG) {
  const base = {}, drift = {};
  for (const k in cfg.metrics) {
    const vals = [];
    for (let d = cfg.baseline.start; d <= cfg.baseline.end; d++) {
      const v = series[k][d - 1];
      if (v != null) vals.push(v);
    }
    const m = mean(vals);
    const s = Math.max(std(vals, m), cfg.metrics[k].sd * cfg.sdFloor);
    base[k] = { mean: m, sd: s };
    let e = 0;
    drift[k] = [];
    for (let d = 1; d <= cfg.days; d++) {
      const v = series[k][d - 1];
      if (v != null && d >= cfg.baseline.start) {
        const z = clamp(((v - m) / s) * cfg.metrics[k].dir, -6, 6);
        e = cfg.ewmaLambda * z + (1 - cfg.ewmaLambda) * e;
      }
      drift[k].push(e); // missing days carry the last drift forward, never imputed values
    }
  }
  const cum = [];
  let c = 0;
  for (let d = 1; d <= cfg.days; d++) {
    c += series.dose[d - 1] ?? base.dose.mean; // gap in dosimeter: assume baseline rate
    cum.push(c);
  }
  return { series, base, drift, cum, cfg };
}

const driftAt = (ctx, k, d) => ctx.drift[k][d - 1];

/** Day (1-based) of a solar particle event within the last w days, else 0. */
export function recentSpe(ctx, t, w) {
  const th = ctx.cfg.radiation.speDoseThreshold;
  for (let d = Math.max(1, t - w); d <= t; d++) {
    const v = ctx.series.dose[d - 1];
    if (v != null && v > th) return d;
  }
  return 0;
}

function level(ctx, k, d, tight) {
  const e = driftAt(ctx, k, d), f = tight ? ctx.cfg.immuneTightFactor : 1;
  return e >= ctx.cfg.red * f ? 2 : e >= ctx.cfg.amber * f ? 1 : 0;
}

// A level only counts if it held for `persistence` consecutive days.
function sustained(ctx, k, t, tight) {
  let lv = 2;
  for (let p = 0; p < ctx.cfg.persistence; p++) lv = Math.min(lv, level(ctx, k, Math.max(1, t - p), tight));
  return lv;
}

export function formatValue(cfg, k, v) {
  return v == null ? "no data" : `${v.toFixed(cfg.metrics[k].dec)} ${cfg.metrics[k].unit}`;
}

function lastValue(ctx, k, t) {
  for (let d = t; d > 0; d--) if (ctx.series[k][d - 1] != null) return ctx.series[k][d - 1];
  return null;
}

/** Full status for one mission day. */
export function analyze(ctx, t) {
  const cfg = ctx.cfg, R = cfg.radiation;
  const adapting = t <= cfg.adaptationDays;
  const spe14 = recentSpe(ctx, t, R.speWatchDays);
  const speNow = recentSpe(ctx, t, R.speActiveDays - 1);
  const domains = {};

  for (const dm in cfg.domains) {
    const tight = dm === "imm" && spe14 > 0;
    const indicators = [];
    let status = 0, have = 0, total = 0, score = 0;
    for (const k in cfg.metrics) {
      if (cfg.metrics[k].domain !== dm) continue;
      for (let q = Math.max(1, t - 6); q <= t; q++) { total++; if (ctx.series[k][q - 1] != null) have++; }
      const lv = adapting ? 0 : sustained(ctx, k, t, tight);
      status = Math.max(status, lv);
      score = Math.max(score, driftAt(ctx, k, t));
      indicators.push({
        key: k, name: cfg.metrics[k].name, value: lastValue(ctx, k, t),
        baseline: ctx.base[k].mean, drift: driftAt(ctx, k, t), level: lv,
      });
    }
    indicators.sort((a, b) => b.drift - a.drift);
    domains[dm] = { status: adapting ? LEARNING : status, score, indicators, confidence: have / total, rule: null };
  }

  const contributors = [];
  const lv = (k) => (adapting ? 0 : sustained(ctx, k, t, k === "temp" || k === "fat" ? spe14 > 0 : false));
  if (!adapting) {
    if (lv("temp") >= 1 && (lv("fat") >= 1 || lv("hr") >= 1 || lv("slp") >= 1)) {
      contributors.push({ domain: "imm", text: "Infection pattern: temperature is up together with fatigue, heart rate or poor sleep." });
      domains.imm.status = 2; domains.imm.rule = "infection";
    }
    if (lv("co2") >= 1 && (lv("mood") >= 1 || lv("slp") >= 1 || lv("stress") >= 1)) {
      contributors.push({ domain: "env", text: "Habitat pattern: raised CO2 with worse sleep or mood. Check the air before blaming health." });
      domains.env.status = 2; domains.env.rule = "habitat";
    }
    if (lv("ex") >= 1 && lv("grip") >= 1) contributors.push({ domain: "msk", text: "Exercise is below target and grip is falling: bone and muscle loading is slipping." });
    else if (lv("ex") >= 1) contributors.push({ domain: "msk", text: "Exercise is below target. Bone and muscle loss builds quietly." });
    if (speNow) { domains.rad.status = 2; domains.rad.rule = "spe"; }
    else if (spe14) {
      domains.rad.status = 1;
      contributors.push({ domain: "imm", text: "Solar particle event in the last 14 days: immune thresholds are tighter." });
    } else if (ctx.cum[t - 1] / R.missionLimitmSv > R.cumulativeWatchFraction) domains.rad.status = 1;
  }

  const sts = Object.values(domains).map((d) => Math.max(0, d.status));
  const worst = Math.max(...sts), actCount = sts.filter((s) => s === 2).length;
  const worstDomain = Object.keys(domains).sort((a, b) => Math.max(0, domains[b].status) - Math.max(0, domains[a].status) || domains[b].score - domains[a].score)[0];
  const tier = adapting ? 0 : actCount >= 2 || Object.values(domains).some((d) => d.rule === "infection" || d.rule === "spe") ? 3 : worst === 2 ? 2 : worst === 1 ? 1 : 0;

  return {
    day: t, adapting, domains, contributors, forecast: adapting ? null : forecast(ctx, t),
    overall: { status: adapting ? LEARNING : worst, tier, worstDomain },
    spe: speNow ? { day: speNow, dose: ctx.series.dose[speNow - 1] } : null,
    cumDose: ctx.cum[t - 1],
  };
}

/** Linear projection: which indicator will reach Watch soonest at its current slope. */
export function forecast(ctx, t) {
  const F = ctx.cfg.forecast;
  if (t <= F.windowDays + ctx.cfg.baseline.start) return null;
  let best = null;
  for (const k in ctx.cfg.metrics) {
    if (k === "dose") continue;
    const e = driftAt(ctx, k, t), slope = (e - driftAt(ctx, k, t - F.windowDays)) / F.windowDays;
    if (e >= F.minDrift && e < ctx.cfg.amber && slope > F.minSlope) {
      const days = Math.max(1, Math.round((ctx.cfg.amber - e) / slope));
      if (days <= F.maxHorizonDays && (!best || days < best.days)) best = { key: k, name: ctx.cfg.metrics[k].name, days };
    }
  }
  return best;
}

export function reasonLines(ctx, a, dm, max = 3) {
  const cfg = ctx.cfg;
  return a.domains[dm].indicators.filter((i) => i.drift >= 0.5).slice(0, max).map(
    (i) => `${i.name} ${formatValue(cfg, i.key, i.value)} vs your usual ${i.baseline.toFixed(cfg.metrics[i.key].dec)}, drift ${i.drift.toFixed(1)}`);
}

/** Plain-text summary an astronaut can send to ground. */
export function groundSummary(ctx, t) {
  const cfg = ctx.cfg, a = analyze(ctx, t), L = ["Normal", "Watch", "Act"];
  let s = `MISSION VITALS GROUND SUMMARY (simulated data)\nMission day ${t} of ${cfg.days}. Escalation tier: ${a.overall.tier}\n\n`;
  for (const dm in cfg.domains) {
    const st = a.domains[dm].status;
    s += `${cfg.domains[dm]}: ${st === LEARNING ? "Learning baseline" : L[st]}\n`;
    reasonLines(ctx, a, dm).forEach((l) => (s += `  - ${l}\n`));
  }
  s += "\nContributing patterns:\n" + (a.contributors.length ? a.contributors.map((c) => `  - ${c.text}`).join("\n") : "  none");
  s += "\n\nLast 14 days (daily values, - = not logged):\n";
  for (const k of ["temp", "hr", "slp", "fat", "mood", "ex", "co2", "dose"]) {
    const row = [];
    for (let d = Math.max(1, t - 13); d <= t; d++) { const v = ctx.series[k][d - 1]; row.push(v == null ? "-" : v.toFixed(1)); }
    s += `  ${cfg.metrics[k].name} (${cfg.metrics[k].unit}): ${row.join(", ")}\n`;
  }
  s += `\nCumulative radiation: ${a.cumDose.toFixed(0)} of ${cfg.radiation.missionLimitmSv} mSv.\nDecision support only, not a diagnosis.`;
  return s;
}
