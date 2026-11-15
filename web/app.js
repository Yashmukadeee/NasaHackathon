/**
 * ASTRA — Astronaut Vital Telemetry & Autonomous Decision Support System
 * web/app.js — Flight Deck Application Controller (Complete Frontend Transformation)
 *
 * Implements:
 * - Persistent Sidebar Navigation (11 views)
 * - Top Aerospace Header with MET Clock & Network Status
 * - Mission Overview Dashboard (Reference 1 & 2 Synthesis)
 * - Holographic Anatomical Digital Twin with Interactive Organ Hotspots & Layers
 * - Live Physiology with Real-time Simulated ECG Oscilloscope Canvas
 * - 17-Parameter Telemetry Matrix & Cardiac Multi-Trend Spline Chart
 * - High-Precision Health Monitoring with ±1 SD / ±2 SD Baseline Confidence Bands
 * - Deterministic Health Intelligence (CDSS)
 * - Daily Astronaut Check-in with IndexedDB persistence & Store-and-Forward sync
 * - Subsystems: Radiation Intelligence, Mental Health, Bone & Muscle, Environmental
 * - 180-Day Mission Timeline Trajectory Scrubber with Scenario Jumps
 * - Mission Data & Synchronization Manager
 * - Settings with Multi-Astronaut Switching (ASTRO-1, ASTRO-2, ASTRO-3)
 */

import { CONFIG as C } from "./config.js";
import { prepare, analyze, groundSummary, reasonLines, formatValue, LEARNING } from "./engine.js";
import { playChime, playWarn, playXP, setMuted, isMuted } from "./sound.js";
import {
  initDB,
  saveTelemetry,
  getTelemetry,
  getTelemetryRange,
  saveCheckIn,
  getCheckIns,
  saveAlert,
  getAlerts,
  addToSyncQueue,
  getPendingSync,
  markSyncComplete,
  getDatabaseStats,
  seedInitialData,
  DEFAULT_ASTRONAUTS,
} from "./db.js";

// ── DOM Helper & Constants ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const N = C.days;
const LBL = ["Normal", "Watch", "Act"];
const GLY = ["●", "▲", "■"];
const st = (s) => (s === LEARNING ? "Learning baseline" : LBL[s]);
const gl = (s) => (s === LEARNING ? "—" : GLY[s]);
const cls = (s) => (s === LEARNING ? "sm" : s === 0 ? "ok" : s === 1 ? "warn" : "crit");

// ── Application State ────────────────────────────────────────────────────────
let mission = null;
let ctx = null;
let T = 30; // Current Mission Day (1–180)
let SEL = "car"; // Selected Anatomical / Clinical Domain
let timer = null; // Timeline animation timer
let prevStatus = null; // Audio alert state tracker
let activeTab = "tab-overview";
let currentAstronaut = DEFAULT_ASTRONAUTS[0]; // Default: ASTRO-1 CDR. Alex Chen
let monMetric = "hr"; // Active metric on Health Monitoring tab
let monRange = 14; // Day range for monitoring chart
let cardiacDays = 7; // Day range for cardiac multi-chart

// ── 17 Parameter Specification ───────────────────────────────────────────────
const ALL_METRICS_KEYS = [
  "hr", "hrv", "spo2", "sbp", "dbp", "temp", "slp", "fat",
  "ex", "grip", "nutrition", "hydration", "mood", "stress",
  "headache", "co2", "dose"
];

// Check-in form fields with clear categories and clean aerospace styling
const CHECKIN_FIELDS = [
  { k: "mood", icon: "", label: "Subjective Mood", min: 0, max: 10, step: 1, unit: "/10" },
  { k: "stress", icon: "", label: "Workload Stress", min: 0, max: 10, step: 1, unit: "/10" },
  { k: "fat", icon: "", label: "Physical Fatigue", min: 0, max: 10, step: 1, unit: "/10" },
  { k: "slp", icon: "", label: "Sleep Rested", min: 0, max: 12, step: 0.5, unit: "h" },
  { k: "hydration", icon: "", label: "Hydration Intake", min: 0, max: 15, step: 1, unit: "gl" },
  { k: "nutrition", icon: "", label: "Nutrition Quality", min: 0, max: 10, step: 1, unit: "/10" },
  { k: "headache", icon: "", label: "Headache / Pressure", min: 0, max: 10, step: 1, unit: "/10" },
  { k: "sbp", icon: "", label: "Systolic BP", min: 90, max: 180, step: 1, unit: "mmHg" },
  { k: "dbp", icon: "", label: "Diastolic BP", min: 60, max: 120, step: 1, unit: "mmHg" },
];

// ── Sparkline Generator (SVG Vector Mini-Chart) ─────────────────────────────
function sparklineSvg(driftArray, maxDay, amberThresh, redThresh) {
  const w = 180, h = 32;
  const pts = [];
  for (let d = 1; d <= maxDay; d++) {
    const val = driftArray[d - 1] ?? 0;
    const clamped = Math.min(Math.max(val, 0), 3.5);
    const x = ((d / N) * w).toFixed(1);
    const y = (h - 2 - (clamped / 3.5) * (h - 4)).toFixed(1);
    pts.push(`${x},${y}`);
  }
  const yAmber = h - 2 - (amberThresh / 3.5) * (h - 4);
  const yRed = h - 2 - (redThresh / 3.5) * (h - 4);

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="${w}" y1="${yAmber}" y2="${yAmber}" stroke="var(--status-warn)" stroke-dasharray="3 3" opacity=".6"/>
    <line x1="0" x2="${w}" y1="${yRed}" y2="${yRed}" stroke="var(--status-crit)" stroke-dasharray="3 3" opacity=".6"/>
    <polyline fill="none" stroke="var(--cyan)" stroke-width="1.8" points="${pts.join(" ")}"/>
  </svg>`;
}

// ── Live ECG Oscilloscope Sweep Animation (Reference 1 Panel 05) ────────────
let ecgAnimationId = null;
let ecgX = 0;
const ecgPoints = [];
const ECG_BUFFER_LEN = 600;

function initEcgCanvas() {
  const canvas = $("ecg-canvas");
  if (!canvas) return;
  const ctx2d = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  // Initialize buffer
  for (let i = 0; i < w; i++) ecgPoints[i] = h / 2;

  function drawEcg() {
    // Current heart rate determines beat interval
    const hr = mission.series.hr ? (mission.series.hr[T - 1] ?? 62) : 62;
    const beatInterval = Math.max(20, Math.floor(60 / hr * 60)); // frames between QRS

    // Generate P-Q-R-S-T wave pattern
    const phase = ecgX % beatInterval;
    let yOffset = 0;
    if (phase === 10) yOffset = -4; // P wave
    else if (phase === 12) yOffset = 2;
    else if (phase === 18) yOffset = 4; // Q wave
    else if (phase === 20) yOffset = -34; // R peak
    else if (phase === 22) yOffset = 14; // S wave
    else if (phase === 28) yOffset = -8; // T wave
    else if (phase === 32) yOffset = 0;

    const baseLine = h / 2;
    ecgPoints[ecgX] = baseLine + yOffset + (Math.random() * 1.5 - 0.75); // Subtle noise

    // Clear with trailing alpha for phosphor persistence
    ctx2d.fillStyle = "rgba(4, 9, 15, 0.12)";
    ctx2d.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx2d.strokeStyle = "rgba(54, 230, 208, 0.06)";
    ctx2d.lineWidth = 0.5;
    for (let gy = 0; gy < h; gy += 20) {
      ctx2d.beginPath(); ctx2d.moveTo(0, gy); ctx2d.lineTo(w, gy); ctx2d.stroke();
    }
    for (let gx = 0; gx < w; gx += 20) {
      ctx2d.beginPath(); ctx2d.moveTo(gx, 0); ctx2d.lineTo(gx, h); ctx2d.stroke();
    }

    // Draw Sweep Line & Waveform
    ctx2d.strokeStyle = "#36E6D0";
    ctx2d.lineWidth = 1.8;
    ctx2d.shadowColor = "#36E6D0";
    ctx2d.shadowBlur = 6;
    ctx2d.beginPath();

    const startX = Math.max(0, ecgX - 120);
    for (let i = startX; i <= ecgX; i++) {
      if (i === startX) ctx2d.moveTo(i, ecgPoints[i]);
      else ctx2d.lineTo(i, ecgPoints[i]);
    }
    ctx2d.stroke();
    ctx2d.shadowBlur = 0; // reset

    // Sweep cursor bar
    ctx2d.fillStyle = "#E8F5F7";
    ctx2d.fillRect(ecgX, 0, 2, h);

    ecgX = (ecgX + 2) % w;
    ecgAnimationId = requestAnimationFrame(drawEcg);
  }

  if (ecgAnimationId) cancelAnimationFrame(ecgAnimationId);
  ecgAnimationId = requestAnimationFrame(drawEcg);
}

// ── Top KPI Analytical Cards (Part 4B) ──────────────────────────────────────
function renderKpiCards(a) {
  const o = a.overall;
  const t = T;

  // Overall Health
  const healthEl = $("kpi-health-status");
  const healthSub = $("kpi-health-sub");
  if (healthEl) {
    if (a.adapting) {
      healthEl.textContent = "Learning";
      healthEl.className = "kpi-val mu";
      if (healthSub) healthSub.textContent = "Days 1–7 microgravity adaptation";
    } else {
      healthEl.textContent = ["Ready", "Watch closely", "Act now"][o.status] || "Ready";
      healthEl.className = `kpi-val ${cls(o.status)}`;
      if (healthSub) healthSub.textContent = o.status === 0 ? "All physiological baselines nominal" : `Tier ${o.tier} Action Protocol`;
    }
  }

  // Active Alerts
  let alertCount = 0;
  for (const dm in a.domains) {
    if (a.domains[dm].status >= 1) alertCount++;
  }
  if ($("kpi-alert-count")) $("kpi-alert-count").textContent = alertCount;
  if ($("kpi-alert-tier")) $("kpi-alert-tier").textContent = `Tier ${o.tier} (${o.tier === 3 ? "Ground Escalate" : o.tier === 2 ? "Crew Medical Officer" : o.tier === 1 ? "Self-Manage" : "Nominal Routine"})`;
  if ($("alert-pill-badge")) {
    $("alert-pill-badge").textContent = alertCount;
    $("alert-pill-badge").style.display = alertCount > 0 ? "inline-block" : "none";
  }

  // Nominal count out of 17
  let normCount = 0;
  ALL_METRICS_KEYS.forEach((k) => {
    const drift = ctx.drift[k] ? ctx.drift[k][t - 1] : 0;
    if (Math.abs(drift) < C.amber) normCount++;
  });
  if ($("kpi-norm-count")) $("kpi-norm-count").textContent = `${normCount} / 17`;

  // Radiation Cumulative
  if ($("kpi-rad-val")) $("kpi-rad-val").textContent = `${a.cumDose.toFixed(1)} mSv`;

  // Forecast
  const f = a.forecast;
  if ($("kpi-forecast-val")) $("kpi-forecast-val").textContent = f ? f.name : "Nominal";
  if ($("kpi-forecast-sub")) $("kpi-forecast-sub").textContent = f ? `Drifting to Watch in ~${f.days} days` : "No parameters trending to Watch";
}

// ── Live Physiology Readouts (Part 6) ───────────────────────────────────────
function renderLivePhysiology(t) {
  const hr = mission.series.hr ? (mission.series.hr[t - 1] ?? 62) : 62;
  const spo2 = mission.series.spo2 ? (mission.series.spo2[t - 1] ?? 98.2) : 98.2;
  const hrv = mission.series.hrv ? (mission.series.hrv[t - 1] ?? 58) : 58;
  const sbp = mission.series.sbp ? (mission.series.sbp[t - 1] ?? 118) : 118;
  const dbp = mission.series.dbp ? (mission.series.dbp[t - 1] ?? 76) : 76;
  const temp = mission.series.temp ? (mission.series.temp[t - 1] ?? 36.6) : 36.6;

  if ($("live-hr-val")) $("live-hr-val").textContent = Math.round(hr);
  if ($("live-spo2-val")) $("live-spo2-val").textContent = spo2.toFixed(1);
  if ($("live-hrv-val")) $("live-hrv-val").textContent = Math.round(hrv);
  if ($("live-bp-val")) $("live-bp-val").textContent = `${Math.round(sbp)}/${Math.round(dbp)}`;
  if ($("live-temp-val")) $("live-temp-val").textContent = temp.toFixed(1);

  // Status badges
  if ($("live-hr-status")) {
    const hrDrift = ctx.drift.hr ? ctx.drift.hr[t - 1] : 0;
    $("live-hr-status").className = `phys-status ${cls(hrDrift >= C.red ? 2 : hrDrift >= C.amber ? 1 : 0)}`;
    $("live-hr-status").textContent = hrDrift >= C.red ? "▲ ELEVATED" : hrDrift >= C.amber ? "▲ DRIFTING" : "● NOMINAL";
  }
  if ($("live-spo2-status")) {
    const spo2Drift = ctx.drift.spo2 ? ctx.drift.spo2[t - 1] : 0;
    $("live-spo2-status").className = `phys-status ${cls(spo2Drift >= C.red ? 2 : spo2Drift >= C.amber ? 1 : 0)}`;
    $("live-spo2-status").textContent = spo2Drift >= C.red ? "▼ HYPOXIC" : spo2Drift >= C.amber ? "▼ LOW WATCH" : "● OPTIMAL";
  }
  if ($("live-hrv-status")) {
    const hrvDrift = ctx.drift.hrv ? ctx.drift.hrv[t - 1] : 0;
    $("live-hrv-status").className = `phys-status ${cls(hrvDrift >= C.red ? 2 : hrvDrift >= C.amber ? 1 : 0)}`;
    $("live-hrv-status").textContent = hrvDrift >= C.red ? "▼ DEPRESSED TONE" : hrvDrift >= C.amber ? "▼ FATIGUE STRAIN" : "● OPTIMAL TONE";
  }
  if ($("live-bp-status")) {
    const sbpDrift = ctx.drift.sbp ? ctx.drift.sbp[t - 1] : 0;
    $("live-bp-status").className = `phys-status ${cls(sbpDrift >= C.red ? 2 : sbpDrift >= C.amber ? 1 : 0)}`;
    $("live-bp-status").textContent = sbpDrift >= C.red ? "▲ HYPERTENSIVE" : sbpDrift >= C.amber ? "▲ ELEVATED" : "● NORMOTENSIVE";
  }
  if ($("live-temp-status")) {
    const tempDrift = ctx.drift.temp ? ctx.drift.temp[t - 1] : 0;
    $("live-temp-status").className = `phys-status ${cls(tempDrift >= C.red ? 2 : tempDrift >= C.amber ? 1 : 0)}`;
    $("live-temp-status").textContent = tempDrift >= C.red ? "▲ FEBRILE" : tempDrift >= C.amber ? "▲ LOW-GRADE" : "● AFEBRILE";
  }
}

// ── All 17 Vitals Matrix Cards (Part 4C) ────────────────────────────────────
function renderVitalsMatrix(t) {
  const grid = $("vitals-matrix-grid");
  if (!grid) return;

  grid.innerHTML = ALL_METRICS_KEYS.map((k) => {
    const cfg = C.metrics[k] || { name: k, unit: "", dec: 1, dir: 1, domain: "imm" };
    const curVal = mission.series[k] ? mission.series[k][t - 1] : null;
    const baseVal = ctx.base[k] ? ctx.base[k].mean : null;
    const driftVal = ctx.drift[k] ? ctx.drift[k][t - 1] : 0;

    let badgeClass = "ok";
    let badgeText = "Normal";
    if (t > C.adaptationDays) {
      if (driftVal >= C.red) {
        badgeClass = "crit";
        badgeText = "Act";
      } else if (driftVal >= C.amber) {
        badgeClass = "warn";
        badgeText = "Watch";
      }
    } else {
      badgeClass = "sm";
      badgeText = "Learning";
    }

    const driftTrend = driftVal >= 0.5 ? "↑" : driftVal <= -0.5 ? "↓" : "→";
    const formattedVal = curVal != null ? curVal.toFixed(cfg.dec) : "--";
    const formattedBase = baseVal != null ? baseVal.toFixed(cfg.dec) : "--";
    const delta = curVal != null && baseVal != null ? (curVal - baseVal).toFixed(cfg.dec) : "0.0";

    return `
      <div class="matrix-card" data-metric="${k}">
        <div class="matrix-card-top">
          <span class="matrix-card-name">${cfg.name}</span>
          <span class="matrix-chip ${badgeClass}">${badgeText}</span>
        </div>
        <div class="matrix-val-row">
          <span class="matrix-val">${formattedVal}</span>
          <span class="matrix-unit">${cfg.unit}</span>
        </div>
        <div class="matrix-meta">
          <span>Base: <strong>${formattedBase}</strong> (Δ ${delta >= 0 ? "+" : ""}${delta})</span>
          <span>${driftTrend} <strong>${driftVal.toFixed(1)} SD</strong></span>
        </div>
        <div class="matrix-spark">
          ${sparklineSvg(ctx.drift[k] || [], t, C.amber, C.red)}
        </div>
      </div>
    `;
  }).join("");

  // Add click to inspect on Health Monitoring tab
  grid.querySelectorAll(".matrix-card").forEach((card) => {
    card.addEventListener("click", () => {
      monMetric = card.dataset.metric;
      document.querySelector('[data-tab="tab-monitoring"]')?.click();
    });
  });
}

// ── Multi-Metric Cardiac Trend Spline Chart (Reference 2) ───────────────────
function renderCardiacMultiChart(days) {
  const container = $("cardiac-multi-chart");
  if (!container) return;

  const W = 620, H = 180;
  const PAD = { top: 15, right: 20, bottom: 25, left: 40 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const startDay = Math.max(1, T - days + 1);

  // Normalize each metric to 0..1 relative to its range in window
  const hrSeries = mission.series.hr || [];
  const sbpSeries = mission.series.sbp || [];
  const spo2Series = mission.series.spo2 || [];

  const xOf = (d) => PAD.left + ((d - startDay) / Math.max(T - startDay, 1)) * iw;

  const buildPath = (series, min, max) => {
    const pts = [];
    for (let d = startDay; d <= T; d++) {
      const v = series[d - 1];
      if (v != null) {
        const y = PAD.top + ih - ((v - min) / Math.max(max - min, 1)) * ih;
        pts.push([xOf(d), Math.max(PAD.top, Math.min(PAD.top + ih, y))]);
      }
    }
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  };

  const hrPath = buildPath(hrSeries, 50, 90);
  const sbpPath = buildPath(sbpSeries, 100, 150);
  const spo2Path = buildPath(spo2Series, 92, 100);

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`;

  // Grid lines
  for (let s = 0; s <= 3; s++) {
    const yy = PAD.top + (s / 3) * ih;
    svg += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yy}" y2="${yy}" stroke="rgba(66, 185, 232, 0.1)" stroke-width="0.8"/>`;
  }

  // Day X ticks
  for (let d = startDay; d <= T; d++) {
    if ((d - startDay) % Math.max(1, Math.floor((T - startDay) / 5)) === 0 || d === T) {
      svg += `<text x="${xOf(d)}" y="${PAD.top + ih + 16}" text-anchor="middle" font-size="9" fill="var(--text-dim)" font-family="var(--font-mono)">D${d}</text>`;
    }
  }

  // Paths
  if (hrPath) svg += `<path d="${hrPath}" fill="none" stroke="#36E6D0" stroke-width="2.2" stroke-linecap="round"/>`;
  if (sbpPath) svg += `<path d="${sbpPath}" fill="none" stroke="#FF5E68" stroke-width="2.2" stroke-linecap="round"/>`;
  if (spo2Path) svg += `<path d="${spo2Path}" fill="none" stroke="#42B9E8" stroke-width="2.2" stroke-linecap="round"/>`;

  svg += `</svg>`;
  container.innerHTML = svg;
}

// ── Overview Domain Triage Table (Reference 2 Bottom Right) ─────────────────
function renderOverviewTriageTable(a) {
  const tbody = $("overview-triage-body");
  if (!tbody) return;

  tbody.innerHTML = Object.keys(C.domains)
    .map((dm) => {
      const dom = a.domains[dm];
      const s = dom.status;
      const topInd = dom.indicators[0] || { name: "--", drift: 0 };
      const statusTag = s === 2 ? "Act" : s === 1 ? "Watch" : "Normal";
      const statusClass = s === 2 ? "crit" : s === 1 ? "warn" : "ok";
      const actionText = s === 2 ? "Escalate Tier 2/3" : s === 1 ? "Self-Manage (Tier 1)" : "Routine";

      return `
        <tr>
          <td><strong>${C.domains[dm]}</strong></td>
          <td><span class="matrix-chip ${statusClass}">${statusTag}</span></td>
          <td>${topInd.name}</td>
          <td><span class="ok" style="font-family:var(--font-mono)">${topInd.drift >= 0 ? "+" : ""}${topInd.drift.toFixed(1)} SD</span></td>
          <td><span class="mu">${actionText}</span></td>
        </tr>
      `;
    })
    .join("");
}

// ── Anatomical Digital Twin Interactivity (Reference 1 Masterpiece) ─────────
function setupDigitalTwinInteractions() {
  // Layer Toggles
  const layers = {
    surface: $("layer-surface"),
    skeleton: $("layer-skeleton"),
    organs: $("layer-organs"),
    vascular: $("layer-vascular"),
  };

  const updateLayers = () => {
    if ($("twin-surface-group")) $("twin-surface-group").style.display = layers.surface?.checked ? "block" : "none";
    if ($("twin-skeleton-group")) $("twin-skeleton-group").style.display = layers.skeleton?.checked ? "block" : "none";
    if ($("twin-organs-group")) $("twin-organs-group").style.display = layers.organs?.checked ? "block" : "none";
    if ($("twin-vascular-group")) $("twin-vascular-group").style.display = layers.vascular?.checked ? "block" : "none";
  };

  Object.values(layers).forEach((cb) => cb?.addEventListener("change", updateLayers));

  // Organ Hotspots & Callouts
  const tooltip = $("body-tooltip");
  const drawer = $("organ-inspector-drawer");
  const drawerTitle = $("inspector-organ-title");
  const drawerContent = $("inspector-organ-content");

  const openInspector = (domain, organName) => {
    SEL = domain;
    const a = analyze(ctx, T);
    const dom = a.domains[domain];

    if (drawerTitle) drawerTitle.textContent = `${C.domains[domain].toUpperCase()} SYSTEM INSPECTOR · ${organName.toUpperCase()}`;
    if (drawerContent) {
      const indicatorsList = dom.indicators
        .map(
          (i) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(66,185,232,0.1)">
          <span>${i.name}</span>
          <span><strong>${formatValue(C, i.key, i.value)}</strong> (Base: ${i.baseline.toFixed(C.metrics[i.key].dec)}) · Drift: <span class="${cls(i.level)}">${i.drift >= 0 ? "+" : ""}${i.drift.toFixed(1)} SD</span></span>
        </div>
      `
        )
        .join("");

      drawerContent.innerHTML = `
        <div style="margin-bottom:8px">${indicatorsList}</div>
        <div class="mu"><strong>Recommended Protocol:</strong> ${C.actions[domain]?.[dom.status === 2 ? 1 : 0]?.[0] || "Maintain flight routine."}</div>
      `;
    }
    drawer?.classList.add("open");
    render();
  };

  $("inspector-close-btn")?.addEventListener("click", () => drawer?.classList.remove("open"));

  document.querySelectorAll(".twin-hotspot").forEach((hotspot) => {
    hotspot.addEventListener("mouseenter", (e) => {
      const dm = hotspot.dataset.domain;
      if (tooltip) {
        tooltip.textContent = `Inspect ${C.domains[dm]} System (${hotspot.dataset.organ.toUpperCase()})`;
        tooltip.style.display = "block";
      }
    });
    hotspot.addEventListener("mousemove", (e) => {
      if (tooltip) {
        tooltip.style.left = e.clientX + 14 + "px";
        tooltip.style.top = e.clientY - 28 + "px";
      }
    });
    hotspot.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.style.display = "none";
    });
    hotspot.addEventListener("click", () => {
      openInspector(hotspot.dataset.domain, hotspot.dataset.organ);
    });
  });

  document.querySelectorAll(".twin-callout").forEach((callout) => {
    callout.addEventListener("click", () => {
      const target = callout.dataset.target;
      const hotspot = $(`hotspot-${target}`);
      if (hotspot) openInspector(hotspot.dataset.domain, target);
    });
  });
}

// ── Dynamic Physiological Risk Glow & Callout Synchronization ─────────────
function updateDigitalTwinRiskGlow(a) {
  if (!a || !a.domains) return;

  // Domain map to target elements
  const domainTargets = {
    beh: { hotspot: $("hotspot-brain"), callout: document.querySelector('.twin-callout[data-target="brain"]'), valEl: $("callout-brain-val") },
    car: { hotspot: $("hotspot-heart"), callout: document.querySelector('.twin-callout[data-target="heart"]'), valEl: $("callout-heart-val") },
    env: { hotspot: $("hotspot-lungs"), callout: document.querySelector('.twin-callout[data-target="lungs"]'), valEl: $("callout-lungs-val") },
    imm: { hotspot: $("hotspot-abdomen"), callout: document.querySelector('.twin-callout[data-target="abdomen"]'), valEl: $("callout-imm-val") },
    msk: { hotspot: $("hotspot-legs"), callout: document.querySelector('.twin-callout[data-target="legs"]'), valEl: $("callout-msk-val") },
  };

  for (const dm in domainTargets) {
    const item = domainTargets[dm];
    const dom = a.domains[dm];
    if (!dom || !item) continue;

    const status = dom.status ?? -1;

    // Reset glow classes
    if (item.hotspot) {
      item.hotspot.classList.remove("glow-ok", "glow-warn", "glow-crit");
      if (status === 0 || status === LEARNING) {
        item.hotspot.classList.add("glow-ok");
      } else if (status === 1) {
        item.hotspot.classList.add("glow-warn");
      } else if (status === 2) {
        item.hotspot.classList.add("glow-crit");
      }
    }

    if (item.callout) {
      item.callout.classList.remove("callout-glow-warn", "callout-glow-crit");
      if (status === 1) {
        item.callout.classList.add("callout-glow-warn");
      } else if (status === 2) {
        item.callout.classList.add("callout-glow-crit");
      }
    }
  }

  // Also sync arm hotspots for musculoskeletal (msk)
  const armsHotspot = $("hotspot-arms");
  if (armsHotspot && a.domains.msk) {
    const mskStatus = a.domains.msk.status ?? -1;
    armsHotspot.classList.remove("glow-ok", "glow-warn", "glow-crit");
    if (mskStatus === 0 || mskStatus === LEARNING) armsHotspot.classList.add("glow-ok");
    else if (mskStatus === 1) armsHotspot.classList.add("glow-warn");
    else if (mskStatus === 2) armsHotspot.classList.add("glow-crit");
  }
}

// ── Directive Commands Generator for Astronaut Actions ─────────────────────────
function renderActionCommands(a) {
  const box = $("overview-action-box");
  const tierEl = $("overview-action-tier");
  const headlineEl = $("overview-action-headline");
  const listEl = $("overview-commands-list");
  const focusBanner = $("workstation-focus-banner");
  const focusTitle = $("focus-banner-title");
  const focusSub = $("focus-banner-sub");
  if (!box || !a) return;

  const o = a.overall;
  const wd = o.worstDomain;
  const ws = a.domains[wd]?.status ?? 0;
  const tier = o.tier;

  // Box border style by tier
  box.classList.remove("tier-warn", "tier-crit");

  // If completely nominal
  if (ws <= 0 && tier === 0) {
    if (tierEl) tierEl.textContent = "TIER 0";
    if (headlineEl) headlineEl.textContent = "All physiological biometrics within nominal flight baseline.";
    if (listEl) {
      listEl.innerHTML = `
        <li><span class="cmd-badge">STABLE</span> Maintain standard resistive exercise (ARED) and sleep routine.</li>
        <li><span class="cmd-badge">ROUTINE</span> Log scheduled 30-second daily biometric check-in.</li>
      `;
    }
    if (focusBanner) focusBanner.style.display = "none";
    return;
  }

  // Active risk detected: mark tier and focus
  const isCrit = ws === 2 || tier >= 2;
  const domainName = C.domains[wd] || wd;

  if (isCrit) {
    box.classList.add("tier-crit");
    if (tierEl) tierEl.textContent = `TIER ${tier} CRITICAL`;
  } else {
    box.classList.add("tier-warn");
    if (tierEl) tierEl.textContent = `TIER ${tier} WATCH`;
  }

  // Update Workstation Focus Banner
  if (focusBanner) {
    focusBanner.style.display = "flex";
    focusBanner.className = `workstation-focus-banner ${isCrit ? "" : "banner-warn"}`;
    if (focusTitle) {
      focusTitle.textContent = isCrit
        ? `CRITICAL PHYSIOLOGICAL ALERT: ${domainName.toUpperCase()}`
        : `WATCH RISK DETECTED: ${domainName.toUpperCase()}`;
    }
    if (focusSub) {
      focusSub.textContent = isCrit
        ? "Immediate crew intervention protocol required — Actionable remediation commands prioritized below."
        : "Autonomous trajectory drift detected — Review preventative countermeasure procedures below.";
    }
    const btn = $("btn-scroll-commands");
    if (btn) {
      btn.onclick = () => {
        box.scrollIntoView({ behavior: "smooth", block: "center" });
        box.style.transform = "scale(1.05)";
        setTimeout(() => (box.style.transform = ""), 600);
      };
    }
  }

  const headline = isCrit
    ? `CRITICAL CONTINGENCY: ${domainName.toUpperCase()} PROTOCOL ACTIVATED`
    : `WATCH DIRECTIVE: ${domainName.toUpperCase()} DEVIATION DETECTED`;
  if (headlineEl) headlineEl.textContent = headline;

  // Fetch tiered action text from config
  const tierActions = ws === 2 ? C.actions[wd]?.[1] : C.actions[wd]?.[0];
  const commands = [];

  if (tierActions && tierActions.length) {
    tierActions.forEach((act, idx) => {
      const badgeType = isCrit ? "crit" : "warn";
      const badgeText = isCrit ? `ACTION 0${idx + 1}` : `STEP 0${idx + 1}`;
      commands.push(`<li><span class="cmd-badge ${badgeType}">${badgeText}</span> ${act}</li>`);
    });
  }

  // Multi-domain synergy additions
  if (a.domains.imm?.status >= 1) {
    commands.push(`<li><span class="cmd-badge ${a.domains.imm.status === 2 ? "crit" : "warn"}">HYDRATION</span> Ingest 500 mL electrolyte solution to support renal and lymphatic clearance.</li>`);
  }
  if (a.domains.env?.status >= 1) {
    commands.push(`<li><span class="cmd-badge ${a.domains.env.status === 2 ? "crit" : "warn"}">ECLSS</span> Inspect cabin airflow ventilation ducts and verify regenerative CO₂ scrubber bed status.</li>`);
  }
  if (a.domains.msk?.status >= 1) {
    commands.push(`<li><span class="cmd-badge ${a.domains.msk.status === 2 ? "crit" : "warn"}">LOADING</span> Complete mandatory 120-minute resistive loading on ARED to prevent bone demineralization.</li>`);
  }
  if (a.spe) {
    commands.unshift(`<li><span class="cmd-badge crit">IMMEDIATE</span> Move entire crew to water-shielded storm shelter module until dosimeter rates subside.</li>`);
  }

  if (listEl) {
    listEl.innerHTML = commands.slice(0, 6).join("");
  }
}

// ── High-Precision Health Monitoring View (Part 7) ──────────────────────────
function renderHealthMonitoringChart(metricKey, daysRange) {
  const container = $("mon-chart-container");
  const infoEl = $("mon-metric-info");
  const tableBody = $("mon-table-body");
  if (!container || !mission.series[metricKey]) return;

  const cfg = C.metrics[metricKey];
  const series = mission.series[metricKey];
  const base = ctx.base[metricKey] || { mean: 0, sd: 1 };
  const endDay = T;
  const startDay = Math.max(1, endDay - daysRange + 1);

  const W = 880, H = 220;
  const PAD = { top: 20, right: 35, bottom: 35, left: 55 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const valsInRange = [];
  for (let d = startDay; d <= endDay; d++) {
    const v = series[d - 1];
    if (v != null) valsInRange.push(v);
  }
  const meanVal = base.mean;
  const sdVal = base.sd;
  let minV = Math.min(...valsInRange, meanVal - 2.5 * sdVal);
  let maxV = Math.max(...valsInRange, meanVal + 2.5 * sdVal);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const span = maxV - minV;
  minV -= span * 0.08;
  maxV += span * 0.08;

  const xOf = (d) => PAD.left + ((d - startDay) / Math.max(endDay - startDay, 1)) * iw;
  const yOf = (v) => PAD.top + ih - ((v - minV) / (maxV - minV)) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">`;

  // Baseline Shaded Confidence Bands (±1 SD and ±2 SD)
  const yPlus2 = Math.max(PAD.top, yOf(meanVal + 2 * sdVal));
  const yMinus2 = Math.min(PAD.top + ih, yOf(meanVal - 2 * sdVal));
  const yPlus1 = Math.max(PAD.top, yOf(meanVal + 1 * sdVal));
  const yMinus1 = Math.min(PAD.top + ih, yOf(meanVal - 1 * sdVal));

  svg += `<rect x="${PAD.left}" y="${yPlus2}" width="${iw}" height="${Math.max(0, yMinus2 - yPlus2)}" fill="rgba(54, 230, 208, 0.05)" />`;
  svg += `<rect x="${PAD.left}" y="${yPlus1}" width="${iw}" height="${Math.max(0, yMinus1 - yPlus1)}" fill="rgba(54, 230, 208, 0.12)" />`;

  // Baseline Mean Line
  const yMean = yOf(meanVal);
  svg += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yMean}" y2="${yMean}" stroke="#36E6D0" stroke-dasharray="4 4" stroke-width="1.2" opacity=".7"/>`;
  svg += `<text x="${W - PAD.right + 4}" y="${yMean + 3}" font-size="9" fill="#36E6D0" font-family="var(--font-mono)">Nominal</text>`;

  // Y-Axis Ticks
  for (let step = 0; step <= 4; step++) {
    const valStep = minV + (step / 4) * (maxV - minV);
    const yy = yOf(valStep);
    svg += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yy}" y2="${yy}" stroke="rgba(66, 185, 232, 0.15)" stroke-width="0.6"/>`;
    svg += `<text x="${PAD.left - 6}" y="${yy + 4}" text-anchor="end" font-size="9" fill="var(--text-dim)" font-family="var(--font-mono)">${valStep.toFixed(cfg.dec)}</text>`;
  }

  // X-Axis Ticks
  for (let d = startDay; d <= endDay; d++) {
    if ((d - startDay) % Math.max(1, Math.floor((endDay - startDay) / 7)) === 0 || d === endDay) {
      svg += `<text x="${xOf(d)}" y="${PAD.top + ih + 16}" text-anchor="middle" font-size="10" fill="var(--text-dim)" font-family="var(--font-mono)">D${d}</text>`;
    }
  }

  // Points & Path
  const dataPoints = [];
  for (let d = startDay; d <= endDay; d++) {
    const v = series[d - 1];
    if (v != null) dataPoints.push({ d, x: xOf(d), y: yOf(v), v });
  }

  if (dataPoints.length > 1) {
    const pathD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    svg += `<path d="${pathD}" fill="none" stroke="#36E6D0" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  dataPoints.forEach((p) => {
    const isCurrent = p.d === endDay;
    svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isCurrent ? 5 : 3}" fill="${isCurrent ? '#36D69A' : '#36E6D0'}" stroke="#07111C" stroke-width="1.5"/>`;
  });

  svg += `</svg>`;
  container.innerHTML = svg;

  // Explanation Card
  if (infoEl) {
    infoEl.innerHTML = `
      <h4>${cfg.name} (${cfg.unit}) · Flight Medicine Context</h4>
      <p>${cfg.edu || "Continuous physiological biometric monitoring against individualized astronaut baseline."}</p>
      <div style="display:flex;gap:18px;margin-top:8px;font-family:var(--font-mono);font-size:0.75rem">
        <span>Baseline Mean: <strong style="color:var(--cyan)">${meanVal.toFixed(cfg.dec)} ${cfg.unit}</strong></span>
        <span>Nominal SD: <strong style="color:var(--cyan)">±${sdVal.toFixed(cfg.dec)}</strong></span>
        <span>System Domain: <strong style="color:var(--cyan)">${C.domains[cfg.domain]}</strong></span>
      </div>
    `;
  }

  // Telemetry Table
  if (tableBody) {
    tableBody.innerHTML = dataPoints
      .slice(-10)
      .reverse()
      .map((p) => {
        const drift = ctx.drift[metricKey] ? ctx.drift[metricKey][p.d - 1] : 0;
        const z = ((p.v - meanVal) / sdVal) * cfg.dir;
        const statusText = drift >= C.red ? "Act" : drift >= C.amber ? "Watch" : "Normal";
        const statusClass = drift >= C.red ? "crit" : drift >= C.amber ? "warn" : "ok";
        return `
          <tr>
            <td><strong>Day ${p.d}</strong></td>
            <td>${p.v.toFixed(cfg.dec)} ${cfg.unit}</td>
            <td>${meanVal.toFixed(cfg.dec)} ${cfg.unit}</td>
            <td style="font-family:var(--font-mono)">${z >= 0 ? "+" : ""}${z.toFixed(2)}</td>
            <td style="font-family:var(--font-mono)">${drift.toFixed(2)} SD</td>
            <td><span class="matrix-chip ${statusClass}">${statusText}</span></td>
          </tr>
        `;
      })
      .join("");
  }
}

// ── Health Intelligence / CDSS View (Part 8) ────────────────────────────────
function renderHealthIntelligenceView(a) {
  const D = a.domains;
  let normCount = 0, watchCount = 0, actCount = 0;

  for (const dm in D) {
    const s = D[dm].status;
    if (s === 2) actCount++;
    else if (s === 1) watchCount++;
    else normCount++;
  }

  if ($("intel-norm-count")) $("intel-norm-count").textContent = normCount;
  if ($("intel-watch-count")) $("intel-watch-count").textContent = watchCount;
  if ($("intel-act-count")) $("intel-act-count").textContent = actCount;
  if ($("intel-tier")) $("intel-tier").textContent = `Tier ${a.overall.tier}`;

  // Synergy Rules
  const rulesListEl = $("intel-rules-list");
  if (rulesListEl) {
    if (a.contributors.length > 0) {
      rulesListEl.innerHTML = a.contributors
        .map(
          (c) => `
        <div class="rule-item">
          <div class="rule-title">Cross-Domain Synergy: ${C.domains[c.domain]}</div>
          <p style="margin:4px 0 0;font-size:0.85rem">${c.text}</p>
        </div>
      `
        )
        .join("");
    } else {
      rulesListEl.innerHTML = `<div class="rule-item" style="border-left-color:var(--status-ok)"><span style="color:var(--status-ok)">● All physiological domains operating within nominal baseline parameters. No cross-domain alert patterns active.</span></div>`;
    }
  }

  // Domain Cards
  const domainCardsEl = $("intel-domain-cards");
  if (domainCardsEl) {
    domainCardsEl.innerHTML = Object.keys(C.domains)
      .map((dm) => {
        const dom = D[dm];
        const s = dom.status;
        const reasons = reasonLines(ctx, a, dm, 3);
        const actionTier1 = C.actions[dm]?.[0]?.[0] || "Maintain standard flight routine.";
        const actionTier2 = C.actions[dm]?.[1]?.[0] || "Involve Crew Medical Officer.";

        return `
          <div class="intel-card" style="border-left: 3px solid ${s === 2 ? 'var(--status-crit)' : s === 1 ? 'var(--status-warn)' : 'var(--status-ok)'}">
            <div class="intel-card-header">
              <strong style="color:var(--text-main)">${C.domains[dm]}</strong>
              <span class="matrix-chip ${cls(s)}">${gl(s)} ${st(s)}</span>
            </div>
            <div style="font-size:0.8rem;margin:8px 0;color:var(--text-muted)">
              ${reasons.length ? reasons.map((r) => `<div>• ${r}</div>`).join("") : "All parameters near personal baseline."}
            </div>
            <div style="font-size:0.75rem;border-top:1px solid var(--border-subtle);padding-top:6px;color:var(--text-dim)">
              <strong style="color:var(--cyan)">Action:</strong> ${s === 2 ? actionTier2 : actionTier1}
            </div>
          </div>
        `;
      })
      .join("");
  }
}

// ── Subsystems Rendering (Radiation, Mental, MSK, ENV) ───────────────────────
function renderSubsystems(a, t) {
  // 1. Radiation
  const cumDose = a.cumDose || 0;
  const limit = C.radiation.missionLimitmSv || 1000;
  const pct = Math.min(100, (cumDose / limit) * 100);
  if ($("rad-cum-num")) $("rad-cum-num").textContent = `${cumDose.toFixed(1)} mSv`;
  if ($("rad-bar-fill")) $("rad-bar-fill").style.width = `${pct}%`;
  if ($("rad-cum-sub")) $("rad-cum-sub").textContent = `${cumDose.toFixed(0)} of ${limit} mSv Career Dose Limit (${pct.toFixed(1)}%)`;

  const dailyDose = mission.series.dose ? (mission.series.dose[t - 1] ?? 1.8) : 1.8;
  if ($("rad-daily-num")) $("rad-daily-num").textContent = `${dailyDose.toFixed(1)} mSv/day`;

  const statusEl = $("rad-spe-status");
  if (statusEl) {
    if (dailyDose > C.radiation.speDoseThreshold) {
      statusEl.className = "badge-status crit";
      statusEl.textContent = "ACTIVE SOLAR PARTICLE EVENT (SPE)";
    } else {
      statusEl.className = "badge-status ok";
      statusEl.textContent = "Nominal GCR Background Exposure";
    }
  }

  // 2. Mental Health
  const mood = mission.series.mood ? (mission.series.mood[t - 1] ?? 7.0) : 7.0;
  const stress = mission.series.stress ? (mission.series.stress[t - 1] ?? 3.0) : 3.0;
  const sleep = mission.series.slp ? (mission.series.slp[t - 1] ?? 7.2) : 7.2;
  const fatigue = mission.series.fat ? (mission.series.fat[t - 1] ?? 3.0) : 3.0;

  if ($("mental-mood-stress")) $("mental-mood-stress").textContent = `${mood.toFixed(1)} / ${stress.toFixed(1)}`;
  if ($("mental-sleep-val")) $("mental-sleep-val").textContent = `${sleep.toFixed(1)} h`;
  if ($("mental-fatigue-val")) $("mental-fatigue-val").textContent = `${fatigue.toFixed(1)} / 10`;

  // 3. Bone & Muscle Health
  const ex = mission.series.ex ? (mission.series.ex[t - 1] ?? 110) : 110;
  const grip = mission.series.grip ? (mission.series.grip[t - 1] ?? 40.0) : 40.0;
  if ($("msk-ex-val")) $("msk-ex-val").textContent = `${Math.round(ex)} min`;
  if ($("msk-grip-val")) $("msk-grip-val").textContent = `${grip.toFixed(1)} kg`;

  const gripDrift = ctx.drift.grip ? ctx.drift.grip[t - 1] : 0;
  const exDrift = ctx.drift.ex ? ctx.drift.ex[t - 1] : 0;
  if ($("msk-bmd-risk")) {
    if (exDrift >= C.red || gripDrift >= C.red) {
      $("msk-bmd-risk").textContent = "High Risk (Loading Deficit)";
      $("msk-bmd-risk").className = "mvi-num crit";
    } else if (exDrift >= C.amber) {
      $("msk-bmd-risk").textContent = "Moderate Risk (-1.5%/mo)";
      $("msk-bmd-risk").className = "mvi-num warn";
    } else {
      $("msk-bmd-risk").textContent = "Nominal Loading Maintained";
      $("msk-bmd-risk").className = "mvi-num ok";
    }
  }

  // 4. Environmental
  const co2 = mission.series.co2 ? (mission.series.co2[t - 1] ?? 3.0) : 3.0;
  if ($("env-co2-val")) $("env-co2-val").textContent = `${co2.toFixed(1)} mmHg`;
  if ($("env-hypercap-val")) {
    const co2Drift = ctx.drift.co2 ? ctx.drift.co2[t - 1] : 0;
    $("env-hypercap-val").textContent = co2Drift >= C.red ? "Critical Hypercapnia" : co2Drift >= C.amber ? "Elevated Warning" : "None (Optimal)";
    $("env-hypercap-val").className = `kpi-val ${cls(co2Drift >= C.red ? 2 : co2Drift >= C.amber ? 1 : 0)}`;
  }
}

// ── Mission Timeline Scrubber (Part 14) ──────────────────────────────────────
const JUMP_SCENARIOS = [
  [30, "Day 30: Nominal Baseline"],
  [64, "Day 64: Early Forecast"],
  [67, "Day 67: Infection Pattern"],
  [93, "Day 93: CO2 Scrubber Spike"],
  [121, "Day 121: Solar Event (SPE)"],
  [140, "Day 140: Bone Loading Drop"],
  [178, "Day 178: Mood & Behavioral Drift"],
];

function setupTimelineScrubber() {
  const jumpsContainer = $("timeline-jumps-grid");
  if (jumpsContainer) {
    jumpsContainer.innerHTML = JUMP_SCENARIOS.map(
      ([day, label]) => `<button class="timeline-jump-btn" data-day="${day}">${label}</button>`
    ).join("");

    jumpsContainer.querySelectorAll(".timeline-jump-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        T = Number(btn.dataset.day);
        render();
      });
    });
  }

  function jumpToDay(newDay) {
    const totalDays = Math.max(180, mission?.series?.hr ? mission.series.hr.length : 180);
    const parsed = parseInt(newDay, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(1, Math.min(totalDays, parsed));
    T = clamped;
    render();
  }

  const dayInput = $("header-day-input");
  if (dayInput) {
    dayInput.addEventListener("input", (e) => jumpToDay(e.target.value));
    dayInput.addEventListener("change", (e) => jumpToDay(e.target.value));
    dayInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        jumpToDay(e.target.value);
        dayInput.blur();
      }
    });
  }

  const prevBtn = $("tl-prev-day-btn");
  if (prevBtn) {
    prevBtn.onclick = () => jumpToDay(T - 1);
  }

  const nextBtn = $("tl-next-day-btn");
  if (nextBtn) {
    nextBtn.onclick = () => jumpToDay(T + 1);
  }

  const slider = $("tl-slider");
  if (slider) {
    slider.oninput = (e) => jumpToDay(e.target.value);
  }

  const playBtn = $("tl-play-btn");
  if (playBtn) {
    playBtn.onclick = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        playBtn.textContent = "PLAY";
        return;
      }
      playBtn.textContent = "PAUSE";
      timer = setInterval(() => {
        if (T >= N) {
          clearInterval(timer);
          timer = null;
          playBtn.textContent = "PLAY";
          return;
        }
        T++;
        render();
      }, 140);
    };
  }
}

function renderTimelineSnapshot(t) {
  const label = $("tl-day-label");
  const slider = $("tl-slider");
  const totalDays = Math.max(180, mission?.series?.hr ? mission.series.hr.length : 180);
  if (label) label.textContent = `Mission Day ${t} of ${totalDays}`;
  if (slider) {
    slider.max = totalDays;
    slider.value = t;
  }

  const content = $("tl-snapshot-content");
  if (content) {
    content.innerHTML = ALL_METRICS_KEYS.slice(0, 8)
      .map((k) => {
        const cfg = C.metrics[k];
        const val = mission.series[k] ? mission.series[k][t - 1] : null;
        return `<div class="snapshot-item"><span>${cfg.name}:</span> <strong>${val != null ? val.toFixed(cfg.dec) : "--"} ${cfg.unit}</strong></div>`;
      })
      .join("");
  }
}

// ── Mission Data Storage & Ground Sync (Part 15) ─────────────────────────────
async function renderMissionDataStats() {
  try {
    const stats = await getDatabaseStats();
    if ($("db-stat-telemetry")) $("db-stat-telemetry").textContent = stats.telemetry || 0;
    if ($("db-stat-checkins")) $("db-stat-checkins").textContent = stats.checkins || 0;
    if ($("db-stat-alerts")) $("db-stat-alerts").textContent = stats.alerts || 0;
    if ($("db-stat-sync")) $("db-stat-sync").textContent = stats.sync_queue || 0;

    const pending = await getPendingSync();
    const queueBody = $("sync-queue-body");
    if (queueBody) {
      if (pending.length === 0) {
        queueBody.innerHTML = `<tr><td colspan="6" class="mu" style="text-align:center">No pending telemetry in synchronization queue. All records synchronized.</td></tr>`;
      } else {
        queueBody.innerHTML = pending
          .map(
            (item) => `
          <tr>
            <td><code>${item.id}</code></td>
            <td><strong>${item.type}</strong></td>
            <td>${item.astronaut_id}</td>
            <td>Day ${item.day}</td>
            <td><span class="matrix-chip warn">${item.status}</span></td>
            <td>${new Date(item.timestamp).toLocaleTimeString()}</td>
          </tr>
        `
          )
          .join("");
      }
    }
  } catch (err) {
    console.warn("[ASTRA] Could not render mission data stats:", err);
  }
}

function setupSyncHandlers() {
  $("btn-trigger-sync")?.addEventListener("click", async () => {
    const btn = $("btn-trigger-sync");
    const msg = $("sync-status-msg");
    btn.disabled = true;
    btn.textContent = "Connecting to Deep Space Network...";

    try {
      const pending = await getPendingSync();
      if (pending.length === 0) {
        if (msg) msg.textContent = "Telemetry buffer up to date. Zero pending records.";
        btn.disabled = false;
        btn.textContent = "Transmit Telemetry to Ground Control";
        return;
      }

      let serverAck = false;
      try {
        const resp = await fetch("/api/v1/sync/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: pending }),
        });
        if (resp.ok) serverAck = true;
      } catch (e) {
        console.log("[ASTRA] Offline transmission mode.");
      }

      for (const item of pending) {
        await markSyncComplete(item.id);
      }

      playChime();
      if (msg) msg.textContent = serverAck ? `Transmitted ${pending.length} telemetry records to Earth.` : `Offline archive complete: ${pending.length} records processed.`;
      await renderMissionDataStats();
    } catch (err) {
      if (msg) msg.textContent = `Transmission error: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Transmit Telemetry to Ground Control";
    }
  });

  $("btn-export-ground")?.addEventListener("click", () => {
    $("gt").textContent = groundSummary(ctx, T);
    $("cm").textContent = "";
    $("dg").showModal();
  });
}

// ── Daily Check-in Setup (Part 9 - Polished & User-Friendly) ─────────────────
function setupCheckinForm() {
  const container = $("full-checkin-fields");
  if (!container) return;

  container.innerHTML = CHECKIN_FIELDS.map(({ k, icon, label, min, max, step, unit }) => {
    const curVal = mission.series[k]
      ? (mission.series[k][T - 1] ?? (ctx.base[k] ? +ctx.base[k].mean.toFixed(1) : min))
      : min;

    return `
      <div class="field-wrap">
        <div class="field-header-row">
          <div class="field-name-wrap">
            <span class="field-icon">${icon}</span>
            <span class="field-title">${label}</span>
          </div>
          <span class="field-value-badge" id="val_${k}">${curVal} ${unit}</span>
        </div>
        <div class="field-controls-row">
          <button type="button" class="step-btn" data-step="-${step}" data-key="${k}">−</button>
          <input id="ci_${k}" class="field-slider" type="range" min="${min}" max="${max}" step="${step}" value="${curVal}">
          <button type="button" class="step-btn" data-step="${step}" data-key="${k}">+</button>
        </div>
      </div>
    `;
  }).join("");

  // Setup input live binding
  CHECKIN_FIELDS.forEach(({ k, unit }) => {
    const inp = $("ci_" + k);
    const val = $("val_" + k);
    if (inp && val) {
      inp.oninput = () => {
        val.textContent = `${inp.value} ${unit}`;
      };
    }
  });

  // Setup +/- Step Buttons
  container.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.key;
      const stepVal = Number(btn.dataset.step);
      const inp = $("ci_" + k);
      const fieldDef = CHECKIN_FIELDS.find(f => f.k === k);
      if (inp && fieldDef) {
        const next = Math.max(fieldDef.min, Math.min(fieldDef.max, Number(inp.value) + stepVal));
        inp.value = next;
        inp.dispatchEvent(new Event("input"));
      }
    });
  });

  // Quick Preset Handlers
  $("preset-nominal")?.addEventListener("click", () => {
    applyCheckinPreset({ mood: 8, stress: 2, fat: 2, slp: 8, sbp: 118, dbp: 76, hydration: 10, nutrition: 8, headache: 0 }, ["None"]);
  });
  $("preset-fatigued")?.addEventListener("click", () => {
    applyCheckinPreset({ mood: 6, stress: 5, fat: 8, slp: 5.5, sbp: 124, dbp: 82, hydration: 6, nutrition: 6, headache: 3 }, ["Fatigue", "BackPain"]);
  });
  $("preset-stress")?.addEventListener("click", () => {
    applyCheckinPreset({ mood: 4, stress: 8, fat: 6, slp: 6, sbp: 132, dbp: 88, hydration: 7, nutrition: 5, headache: 5 }, ["Headache", "Fatigue"]);
  });

  function applyCheckinPreset(vals, symptomsList) {
    for (const k in vals) {
      const inp = $("ci_" + k);
      if (inp) {
        inp.value = vals[k];
        inp.dispatchEvent(new Event("input"));
      }
    }
    document.querySelectorAll("#symptoms-chips input").forEach((cb) => {
      cb.checked = symptomsList.includes(cb.value);
    });
  }

  // Manual Check-in Target Day Selector
  const checkinTargetDay = $("checkin-target-day");
  if (checkinTargetDay) {
    checkinTargetDay.addEventListener("change", (e) => {
      const val = parseInt(e.target.value, 10);
      const totalDays = Math.max(180, mission?.series?.hr ? mission.series.hr.length : 180);
      if (!isNaN(val) && val >= 1 && val <= totalDays) {
        T = val;
        render();
        CHECKIN_FIELDS.forEach(({ k, unit }) => {
          const inp = $("ci_" + k);
          const displayVal = $("val_" + k);
          if (inp && mission?.series?.[k]) {
            const dayVal = mission.series[k][val - 1] ?? inp.value;
            inp.value = dayVal;
            if (displayVal) displayVal.textContent = `${dayVal} ${unit}`;
          }
        });
      }
    });
  }

  $("checkin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetInp = $("checkin-target-day");
    const recordedDay = (targetInp && Number(targetInp.value)) ? Number(targetInp.value) : T;
    const payload = {
      astronaut_id: currentAstronaut.id,
      day: recordedDay,
      symptoms: Array.from(document.querySelectorAll("#symptoms-chips input:checked")).map((cb) => cb.value),
      notes: $("checkin-notes") ? $("checkin-notes").value : "",
    };

    CHECKIN_FIELDS.forEach(({ k }) => {
      const inp = $("ci_" + k);
      if (inp) {
        const num = Number(inp.value);
        payload[k] = num;
        if (mission.series[k]) mission.series[k][recordedDay - 1] = num;
      }
    });

    await saveCheckIn(payload);

    // Save updated telemetry
    const currentVitals = {};
    for (const k in mission.series) currentVitals[k] = mission.series[k][recordedDay - 1];
    await saveTelemetry({
      astronaut_id: currentAstronaut.id,
      day: recordedDay,
      vitals: currentVitals,
      simulated: true,
    });

    // ── ADVANCE TO NEXT DAY (Add one more day to timeline) ──
    const nextDay = recordedDay + 1;
    T = nextDay;

    // Extend series if new day exceeds current length
    const curLen = mission.series.hr ? mission.series.hr.length : N;
    if (T > curLen) {
      for (const k in mission.series) {
        const lastVal = mission.series[k][curLen - 1] ?? (ctx.base[k] ? +ctx.base[k].mean.toFixed(1) : 0);
        mission.series[k].push(lastVal);
      }
      mission.days = mission.series.hr.length;
    }

    const totalDays = Math.max(180, mission.series.hr ? mission.series.hr.length : 180);
    const slider = $("tl-slider");
    if (slider) {
      slider.max = totalDays;
      slider.value = T;
    }

    // Refresh checkin inputs for the new day
    CHECKIN_FIELDS.forEach(({ k, unit }) => {
      const inp = $("ci_" + k);
      const val = $("val_" + k);
      if (inp) {
        const nextVal = mission.series[k] ? (mission.series[k][T - 1] ?? inp.value) : inp.value;
        inp.value = nextVal;
        if (val) val.textContent = `${nextVal} ${unit}`;
      }
    });

    // Reset symptoms to Asymptomatic for the new next day
    document.querySelectorAll("#symptoms-chips input").forEach((cb) => {
      cb.checked = cb.value === "None";
    });
    if ($("checkin-notes")) $("checkin-notes").value = "";

    playXP();
    const fb = $("checkin-feedback");
    if (fb) {
      fb.innerHTML = `<strong>Day ${recordedDay} saved!</strong> Added and advanced to <strong>Mission Day ${T}</strong>.`;
      setTimeout(() => (fb.innerHTML = ""), 6000);
    }

    recompute();
  });
}

// ── Multi-Astronaut Profile Switcher (Part 16) ──────────────────────────────
function setupAstronautRoster() {
  const container = $("astro-select-grid");
  if (!container) return;

  container.innerHTML = DEFAULT_ASTRONAUTS.map(
    (astro) => `
    <div class="astro-card ${astro.id === currentAstronaut.id ? "selected" : ""}" data-id="${astro.id}">
      <h4>${astro.name}</h4>
      <div style="font-size:0.82rem;color:var(--cyan)">${astro.rank} · ${astro.id}</div>
      <div class="mu" style="font-size:0.78rem;margin-top:4px">${astro.role}</div>
      <div class="mu" style="font-size:0.75rem;margin-top:6px">Blood: ${astro.blood_type} · Age: ${astro.age}</div>
    </div>
  `
  ).join("");

  container.querySelectorAll(".astro-card").forEach((card) => {
    card.addEventListener("click", () => {
      const sel = DEFAULT_ASTRONAUTS.find((a) => a.id === card.dataset.id);
      if (sel) {
        currentAstronaut = sel;
        $("sidebar-astro-name").textContent = `${sel.rank.substring(0, 3)}. ${sel.name}`;
        $("sidebar-astro-role").textContent = `${sel.role.split("&")[0].trim()} · ${sel.id}`;
        setupAstronautRoster();
        render();
      }
    });
  });

  $("sidebar-switch-astro")?.addEventListener("click", () => {
    document.querySelector('[data-tab="tab-settings"]')?.click();
  });

  $("btn-reseed-db")?.addEventListener("click", async () => {
    await seedInitialData(mission);
    const fb = $("reseed-feedback");
    if (fb) fb.textContent = "IndexedDB re-seeded successfully.";
    await renderMissionDataStats();
  });
}

// ── Educational & Crew Modals ───────────────────────────────────────────────
function showEduModal(dm) {
  const edu = C.domainEdu[dm];
  if (!edu) return;
  $("edu-title").textContent = `ⓘ ${edu.title}`;
  $("edu-about").textContent = edu.about;
  $("edu-nasa").textContent = edu.nasa;
  $("edu-tiers").innerHTML = edu.tiers.map((t) => `<li>${t}</li>`).join("");

  const srcEl = $("edu-sources");
  if (srcEl) {
    const links = [];
    if (edu.source) links.push(`<a href="${edu.source.url}" target="_blank" rel="noopener">NASA HRP: ${edu.source.label}</a>`);
    if (edu.csaSource) links.push(`<a href="${edu.csaSource.url}" target="_blank" rel="noopener">CSA Space Health: ${edu.csaSource.label}</a>`);
    srcEl.innerHTML = links.length ? `<div class="edu-sources-label">Scientific Foundations</div>` + links.join("") : "";
  }

  $("edu-modal").showModal();
}

function renderCrewModal(t) {
  const statusColor = (s) =>
    s === LEARNING ? "var(--status-na)" : s === 0 ? "var(--status-ok)" : s === 1 ? "var(--status-warn)" : "var(--status-crit)";
  const CREW_SIM = [
    { name: "CDR. Alex Chen", role: "Commander", status: analyze(ctx, t).overall.status },
    { name: "LCDR. Sarah Tanaka", role: "Crew Medical Officer", status: 0 },
    { name: "Marcus Vance", role: "Habitat Engineer", status: t >= 90 && t <= 96 ? 1 : 0 },
    { name: "Dr. Elena Rostova", role: "Payload Specialist", status: 0 },
  ];

  $("crew-grid").innerHTML = CREW_SIM.map(
    (cr) => `
    <div class="card-panel" style="padding:12px;background:var(--bg-card-sec)">
      <h4>${cr.name}</h4>
      <div class="mu" style="font-size:0.75rem">${cr.role}</div>
      <div style="font-size:1.1rem;font-weight:700;color:${statusColor(cr.status)};margin:6px 0">
        ${gl(cr.status)} ${["Ready", "Watch closely", "Act now"][Math.max(0, cr.status)] || "Learning"}
      </div>
      <div style="font-size:0.75rem;color:var(--text-dim)">Autonomous Edge Stream · QOS 99.8%</div>
    </div>
  `
  ).join("");
}

// ── Master Render Function ───────────────────────────────────────────────────
function render() {
  const t = T;
  const a = analyze(ctx, t);
  const o = a.overall;

  // Header & Day Inputs Updates
  const totalDays = Math.max(180, mission?.series?.hr ? mission.series.hr.length : 180);
  if ($("header-date")) $("header-date").textContent = `Mission Day ${t} of ${totalDays}`;

  const dayInput = $("header-day-input");
  if (dayInput && Number(dayInput.value) !== t) {
    dayInput.value = t;
    dayInput.max = totalDays;
  }
  const dayMax = $("header-day-max");
  if (dayMax) dayMax.textContent = totalDays;

  const slider = $("tl-slider");
  if (slider && Number(slider.value) !== t) {
    slider.max = totalDays;
    slider.value = t;
  }

  const checkinDayInput = $("checkin-target-day");
  if (checkinDayInput && Number(checkinDayInput.value) !== t) {
    checkinDayInput.value = t;
    checkinDayInput.max = totalDays;
  }

  if ($("header-phase")) {
    const phaseName = a.adapting ? "Microgravity Adaptation" : a.spe ? "Solar Event Active" : t < 60 ? "Outbound Cruise" : t < 120 ? "Deep Space Transit" : "Mars Approach";
    $("header-phase").textContent = phaseName;
  }
  if ($("header-met")) {
    const pad = (n) => String(n).padStart(2, "0");
    const d3 = String(t).padStart(3, "0");
    $("header-met").textContent = `MET +${d3}:14:22:05`;
  }

  // Solar Particle Event Banner
  const banner = $("global-alert-banner");
  if (banner) {
    banner.innerHTML = a.spe
      ? `ACTIVE SOLAR PARTICLE EVENT (${a.spe.dose.toFixed(1)} mSv/day): Retreat to water-shielded storm shelter immediately and log occupancy duration.`
      : "";
  }

  // Sound Alerts on Status Escalation
  if (prevStatus !== null && !a.adapting) {
    if (o.status < prevStatus) playChime();
    else if (o.status > prevStatus) playWarn();
  }
  prevStatus = a.adapting ? null : o.status;

  // 1. Render Top KPI Summary Cards (Part 4B)
  renderKpiCards(a);

  // 1b. Update Digital Twin Physiological Risk Glows & Callouts
  updateDigitalTwinRiskGlow(a);

  // 2. Render Live Physiology Panel (Part 6)
  renderLivePhysiology(t);

  // 3. Render 17-Parameter Telemetry Matrix (Part 4C)
  renderVitalsMatrix(t);

  // 4. Render Cardiac Multi-Trend Spline Chart
  renderCardiacMultiChart(cardiacDays);

  // 5. Render Overview Triage Table
  renderOverviewTriageTable(a);

  // 6. Action Box & Operational Directive Commands (Render actionable step-by-step guidance)
  renderActionCommands(a);

  // 7. Active Concerns List
  const concernsList = $("overview-concerns-list");
  if (concernsList) {
    const top = Object.keys(a.domains).filter((d) => a.domains[d].status >= 1);
    concernsList.innerHTML = top.length
      ? "<ul>" + top.map((d) => `<li><strong class="${cls(a.domains[d].status)}">${C.domains[d]}</strong>: ${reasonLines(ctx, a, d, 1)[0] || "Drifting from baseline"}</li>`).join("") + "</ul>"
      : `<span class="mu">No clinical alerts currently active. Physiological vitals stable.</span>`;
  }

  // 8. Re-render Subsystem Views
  renderHealthMonitoringChart(monMetric, monRange);
  renderHealthIntelligenceView(a);
  renderSubsystems(a, t);
  renderTimelineSnapshot(t);
  renderMissionDataStats();
}

function recompute() {
  ctx = prepare(mission.series);
  render();
}

// ── Application Initialization ───────────────────────────────────────────────
async function init() {
  try {
    // 1. Fetch benchmark mission JSON
    const resp = await fetch("data/mission.json");
    mission = await resp.json();

    // 2. Ensure all 17 metrics exist in series
    ALL_METRICS_KEYS.forEach((k) => {
      if (!mission.series[k]) mission.series[k] = new Array(N).fill(null);
    });

    // 3. Initialize IndexedDB & seed data
    try {
      await initDB();
      await seedInitialData(mission);
      if ($("header-db-pill")) {
        $("header-db-pill").className = "header-pill status-ok";
        $("header-db-pill").querySelector("span:last-child").textContent = "IndexedDB Online";
      }
    } catch (dbErr) {
      console.warn("[ASTRA] In-memory database mode:", dbErr);
      if ($("header-db-pill")) {
        $("header-db-pill").className = "header-pill status-delay";
        $("header-db-pill").querySelector("span:last-child").textContent = "Local Memory Mode";
      }
    }

    // 4. Prepare analytics context
    ctx = prepare(mission.series);

    // 5. Setup Top Navigation (Option A)
    document.querySelectorAll(".top-nav .nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".top-nav .nav-item").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".view-panel").forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        const targetView = $(activeTab);
        if (targetView) targetView.classList.add("active");

        if (activeTab === "tab-monitoring") renderHealthMonitoringChart(monMetric, monRange);
        if (activeTab === "tab-intelligence") renderHealthIntelligenceView(analyze(ctx, T));
        if (activeTab === "tab-data") renderMissionDataStats();
      });
    });

    // 6. Setup Interactive Components
    setupDigitalTwinInteractions();
    initEcgCanvas();
    setupCheckinForm();
    setupTimelineScrubber();
    setupSyncHandlers();
    setupAstronautRoster();

    // Cardiac chart timeframe filter pills
    document.querySelectorAll("#cardiac-range-selector button").forEach((pill) => {
      pill.addEventListener("click", () => {
        document.querySelectorAll("#cardiac-range-selector button").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        cardiacDays = Number(pill.dataset.days) || 7;
        renderCardiacMultiChart(cardiacDays);
      });
    });

    // Health monitoring filters
    const monMetricSelect = $("mon-metric-select");
    if (monMetricSelect) {
      monMetricSelect.innerHTML = ALL_METRICS_KEYS.map((k) => `<option value="${k}">${C.metrics[k]?.name || k} (${C.metrics[k]?.unit || ""})</option>`).join("");
      monMetricSelect.value = monMetric;
      monMetricSelect.onchange = (e) => {
        monMetric = e.target.value;
        renderHealthMonitoringChart(monMetric, monRange);
      };
    }

    document.querySelectorAll("#mon-range-group button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#mon-range-group button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        monRange = Number(btn.dataset.range) || 14;
        renderHealthMonitoringChart(monMetric, monRange);
      });
    });

    // Quick Action Buttons
    $("quick-checkin-btn")?.addEventListener("click", () => document.querySelector('[data-tab="tab-checkin"]')?.click());
    $("quick-ground-btn")?.addEventListener("click", () => {
      $("gt").textContent = groundSummary(ctx, T);
      $("cm").textContent = "";
      $("dg").showModal();
    });
    $("btn-open-ground-summary")?.addEventListener("click", () => {
      $("gt").textContent = groundSummary(ctx, T);
      $("cm").textContent = "";
      $("dg").showModal();
    });
    $("crew-ripple-btn")?.addEventListener("click", () => {
      renderCrewModal(T);
      $("crew-modal").showModal();
    });
    $("crew-close")?.addEventListener("click", () => $("crew-modal").close());
    $("cl")?.addEventListener("click", () => $("dg").close());
    $("cp")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("gt").textContent);
        $("cm").textContent = "Transcribed to system clipboard.";
      } catch {
        $("cm").textContent = "Select text and copy manually.";
      }
    });

    // Audio Mute Toggle
    const muteBtn = $("mute-toggle-btn");
    if (muteBtn) {
      muteBtn.onclick = () => {
        const m = !isMuted();
        setMuted(m);
        muteBtn.textContent = m ? "MUTED" : "AUDIO";
      };
    }

    // FastAPI Backend Health & Status Monitor
    const FASTAPI_BASE = "http://localhost:8000/api/v1";
    let isFastApiOnline = false;

    async function checkFastApiBackend() {
      const pill = $("header-fastapi-pill");
      const label = $("fastapi-status-label");
      try {
        const res = await fetch(`${FASTAPI_BASE}/status`, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const data = await res.json();
          isFastApiOnline = true;
          if (pill) { pill.className = "header-pill status-ok"; }
          if (label) { label.textContent = "FastAPI :8000 Online"; }
          return true;
        }
      } catch (e) {
        isFastApiOnline = false;
        if (pill) { pill.className = "header-pill status-delay"; }
        if (label) { label.textContent = "FastAPI Offline (Local Mode)"; }
      }
      return false;
    }

    // Emergency Ground Contact Modal Handlers
    function showEmergencyModal(day = T) {
      const a = analyze(ctx, day);
      const em = $("emergency-modal");
      if (!em) return;

      const titleEl = $("emergency-title");
      const bodyEl = $("emergency-body");
      const actionsEl = $("emergency-actions");
      const badgeEl = $("emergency-comm-badge");

      const worstDm = a.overall.worstDomain;
      const dmName = C.domains[worstDm] || worstDm.toUpperCase();
      const reasons = reasonLines(ctx, a, worstDm);

      if (titleEl) {
        titleEl.textContent = `CRITICAL ALERT — ${dmName.toUpperCase()} DOMAIN`;
      }
      if (bodyEl) {
        bodyEl.innerHTML = `
          <strong>Astronaut:</strong> ${currentAstronaut.name} (${currentAstronaut.id})<br>
          <strong>Mission Day:</strong> Day ${day} of ${N} (Escalation Tier ${a.overall.tier})<br>
          <strong>Clinical Syndrome:</strong> ${a.contributors.length ? a.contributors.map(c => c.text).join(" ") : "Multi-parameter physiological drift exceeding autonomous threshold limits."}<br>
          <div style="margin-top:6px;font-family:var(--font-mono);font-size:0.8rem;color:var(--cyan);">${reasons.join("<br>")}</div>
        `;
      }
      if (actionsEl) {
        const domainActions = (C.actions && C.actions[worstDm] && C.actions[worstDm][1]) || [
          "Perform immediate full vitals re-check and log with Crew Medical Officer.",
          "Prepare emergency medical kit diagnostics.",
          "Request urgent flight surgeon ground telemetry conference."
        ];
        actionsEl.innerHTML = domainActions.map(act => `<li>${act}</li>`).join("");
      }
      if (badgeEl) {
        badgeEl.textContent = "LOCAL QUEUED (READY FOR TRANSMISSION)";
        badgeEl.className = "badge-queued";
      }

      em.showModal();
    }

    $("quick-escalate-btn")?.addEventListener("click", () => {
      showEmergencyModal(T);
    });

    $("btn-commands-escalate")?.addEventListener("click", () => {
      showEmergencyModal(T);
    });

    $("btn-close-emergency")?.addEventListener("click", () => {
      $("emergency-modal")?.close();
    });

    $("btn-transmit-ground")?.addEventListener("click", async () => {
      const badgeEl = $("emergency-comm-badge");
      const transmitBtn = $("btn-transmit-ground");
      if (transmitBtn) {
        transmitBtn.disabled = true;
        transmitBtn.textContent = "TRANSMITTING TELEMETRY...";
      }

      try {
        if (isFastApiOnline) {
          // Send to FastAPI Emergency Report endpoint
          const repRes = await fetch(`${FASTAPI_BASE}/ground-team/emergency-report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              astronaut_id: currentAstronaut.id,
              mission_day: T,
              reason: "Astronaut initiated critical emergency ground contact"
            })
          });
          if (repRes.ok) {
            const repData = await repRes.json();
            // Call transmit endpoint
            await fetch(`${FASTAPI_BASE}/ground-team/contact`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                report_id: repData.report_id,
                astronaut_id: currentAstronaut.id,
                note: "Critical telemetry downlink from ASTRA Flight Deck"
              })
            });

            if (badgeEl) {
              badgeEl.textContent = "TRANSMITTED TO FLIGHT SURGEON QUEUE";
              badgeEl.className = "badge-transmitted";
            }
          }
        } else {
          // Local offline persistent queue fallback via IndexedDB
          await addToSyncQueue({
            action: "EMERGENCY_REPORT",
            endpoint: "/api/v1/ground-team/emergency-report",
            payload: {
              astronaut_id: currentAstronaut.id,
              mission_day: T,
              tier: 3,
              timestamp: new Date().toISOString()
            }
          });
          if (badgeEl) {
            badgeEl.textContent = "OFFLINE STORED IN ONBOARD MEMORY";
            badgeEl.className = "badge-queued";
          }
        }
      } catch (err) {
        console.warn("[ASTRA] Ground transmit warning:", err);
        if (badgeEl) {
          badgeEl.textContent = "SAVED IN SECURE ONBOARD BUFFER";
          badgeEl.className = "badge-queued";
        }
      } finally {
        if (transmitBtn) {
          transmitBtn.disabled = false;
          transmitBtn.textContent = "TRANSMIT TO GROUND CONSOLE";
        }
      }
    });

    // Check backend status on boot and every 30s
    checkFastApiBackend();
    setInterval(checkFastApiBackend, 30000);

    // Initial Master Render
    render();

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
  } catch (err) {
    console.error("[ASTRA] Application boot error:", err);
  }
}

// Start Flight Deck
init();
