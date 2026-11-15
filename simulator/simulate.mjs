#!/usr/bin/env node
/**
 * ASTRA: Simulated Astronaut Telemetry Generator (Pure Node.js)
 * Produces 180-day mission series with physiological indicators and scripted anomalies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAYS = 180;

// Key: [nominal_baseline, noise_sd, missing_probability]
export const METRICS = {
  temp:      [36.6, 0.15, 0.04],
  fat:       [3.0, 0.6, 0.12],
  hr:        [62.0, 2.0, 0.04],
  hrv:       [58.0, 5.0, 0.04],
  spo2:      [98.2, 0.4, 0.04],
  sbp:       [118.0, 3.0, 0.04],
  dbp:       [76.0, 2.0, 0.04],
  ex:        [110.0, 12.0, 0.04],
  grip:      [40.0, 1.0, 0.12],
  nutrition: [8.0, 0.8, 0.12],
  slp:       [7.2, 0.5, 0.04],
  mood:      [7.0, 0.6, 0.12],
  stress:    [3.0, 0.6, 0.12],
  headache:  [1.0, 0.5, 0.12],
  hydration: [8.0, 1.0, 0.08],
  co2:       [3.0, 0.3, 0.0],
  dose:      [1.8, 0.1, 0.0],
};

export const ANOMALIES = [
  { name: "infection", domain: "imm", start: 62, end: 76 },
  { name: "co2_spike", domain: "env", start: 90, end: 96 },
  { name: "bone_loading_drop", domain: "msk", start: 100, end: 140 },
  { name: "solar_particle_event", domain: "rad", start: 120, end: 121 },
  { name: "mood_decline", domain: "beh", start: 150, end: 180 },
];

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function createRng(seed) {
  let s = Math.trunc(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createGaussian(rng) {
  let spare = null;
  return function () {
    if (spare !== null) {
      const res = spare;
      spare = null;
      return res;
    }
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    spare = mag * Math.sin(2.0 * Math.PI * v);
    return mag * Math.cos(2.0 * Math.PI * v);
  };
}

export function generate(seed = 42, anomalies = true) {
  const rng = createRng(seed);
  const g = createGaussian(rng);
  const series = {};
  for (const k in METRICS) series[k] = [];

  for (let d = 1; d <= DAYS; d++) {
    const adapt = d <= 7 ? (1 - d / 7) : 0.0; // microgravity adaptation
    let f = 0.0, co = 0.0, b = 0.0, md = 0.0, spike = 0.0;

    if (anomalies) {
      if (d >= 62 && d <= 72) f = Math.min(1.0, (d - 61) / 10);
      else if (d > 72 && d <= 77) f = Math.max(0.0, 1 - (d - 72) / 5);

      if (d >= 90 && d <= 96) co = 1.0;

      if (d >= 100 && d <= 140) b = Math.min(1.0, (d - 99) / 6);
      else if (d > 140 && d <= 150) b = Math.max(0.0, 1 - (d - 140) / 10);

      if (d === 120) spike = 28.0;
      if (d === 121) spike = 12.0;

      if (d >= 150) md = d - 149;
    }

    const post_spe = anomalies && d >= 121 && d <= 135 ? 1.0 : 0.0;
    const grip_loss = anomalies ? 0.06 * Math.max(0, Math.min(d, 140) - 99) : 0.0;

    const v = {
      temp:      36.6 + 0.15 * g() + 0.9 * f,
      fat:       3.0 + 0.6 * g() + 3.0 * f + adapt + post_spe,
      hr:        62.0 + 2.0 * g() + 7.0 * f + 4.0 * adapt,
      hrv:       58.0 + 5.0 * g() - 12.0 * f,
      spo2:      clamp(98.2 + 0.4 * g() - 1.2 * f - 0.4 * adapt - 0.7 * co, 85, 100),
      sbp:       118.0 + 3.0 * g() + 5.0 * adapt + 4.0 * f + 3.0 * co,
      dbp:       76.0 + 2.0 * g() + 3.0 * adapt + 3.0 * f + 2.0 * co,
      ex:        110.0 + 12.0 * g() - 55.0 * b,
      grip:      40.0 + 1.0 * g() - grip_loss,
      nutrition: clamp(8.0 + 0.8 * g() - 1.5 * f - 1.0 * b, 0, 10),
      slp:       7.2 + 0.5 * g() - 1.5 * f - 0.6 * adapt - 1.0 * co,
      mood:      7.0 + 0.6 * g() - 1.5 * co - 0.04 * md,
      stress:    3.0 + 0.6 * g() + 1.5 * co + 0.03 * md + f,
      headache:  clamp(1.0 + 0.5 * g() + 2.5 * co + 2.0 * adapt + 1.5 * f, 0, 10),
      hydration: clamp(8.0 + 1.0 * g() - 2.0 * adapt - 1.5 * f, 0, 15),
      co2:       3.0 + 0.3 * g() + 3.5 * co,
      dose:      1.8 + 0.1 * g() + spike,
    };

    for (const k in METRICS) {
      const [_, __, missProb] = METRICS[k];
      const missing = d > 1 && rng() < missProb;
      let val = missing ? null : Math.round(v[k] * 1000) / 1000;
      if (val !== null && (k === "fat" || k === "mood" || k === "stress" || k === "nutrition" || k === "headache")) {
        val = Math.round(clamp(val, 0, 10) * 100) / 100;
      }
      series[k].push(val);
    }
  }

  return {
    meta: {
      seed,
      days: DAYS,
      simulated: true,
      anomalies: anomalies ? ANOMALIES : [],
    },
    series,
  };
}

export function write(filePath, obj) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(obj));
  console.log("wrote", fullPath);
}

// CLI Execution
const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  const args = process.argv.slice(2);
  const isAll = args.includes("--all");
  const noAnomalies = args.includes("--no-anomalies");
  const seedIdx = args.indexOf("--seed");
  const seed = seedIdx !== -1 ? Number(args[seedIdx + 1]) || 42 : 42;
  const outIdx = args.indexOf("--out");
  const outPath = outIdx !== -1 ? args[outIdx + 1] : "web/data/mission.json";

  if (isAll) {
    write("web/data/mission.json", generate(42, true));
    for (let s = 1; s <= 20; s++) {
      write(`web/data/eval/anomalous_${s}.json`, generate(s, true));
      write(`web/data/eval/healthy_${s}.json`, generate(100 + s, false));
    }
    console.log("[ASTRA] Generated 1 benchmark mission + 40 evaluation datasets.");
  } else {
    write(outPath, generate(seed, !noAnomalies));
  }
}
