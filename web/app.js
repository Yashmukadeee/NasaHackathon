/**
 * app.js — Mission Vitals main application controller.
 * Coordinates engine, DOM, XP/achievements, body map, charts, sound, crew view, 3D body scan.
 */
import { CONFIG as C } from "./config.js";
import { prepare, analyze, groundSummary, reasonLines, formatValue, LEARNING } from "./engine.js";
import { playChime, playWarn, playXP, setMuted, isMuted } from "./sound.js";
import { initBody3D, updateStatus as body3dUpdateStatus } from "./body3d.js";

// ── Zone improvement data (mirrors body3d.js ZONES) ──────────────────────────
const ZONE_IMPROVEMENTS = {
  beh: {
    label: "Mind & Mood", icon: "🧠",
    improvements: [
      "😴 Follow sleep wind-down: dim lights 1 hr before rest",
      "📞 Schedule crew social or private ground call",
      "🧘 10-min mindfulness or breathing exercise",
      "📓 Log mood & stress daily for trend tracking",
    ]
  },
  car: {
    label: "Cardiovascular", icon: "❤️",
    improvements: [
      "💧 Drink 500 ml water and rest for 30 min",
      "❤️ Measure resting HR again tomorrow morning",
      "🚴 Add light aerobic session if cleared by protocol",
      "📊 Check blood pressure; note dizziness or head fullness",
    ]
  },
  imm: {
    label: "Immune System", icon: "🛡️",
    improvements: [
      "🌡️ Log temperature every 6 hours",
      "💧 Increase water intake; reduce workload",
      "🤧 Distance from crew if fever or cough present",
      "📋 Crew medical officer: record full vitals & symptoms",
    ]
  },
  msk: {
    label: "Bone & Muscle", icon: "🏋️",
    improvements: [
      "🏋️ Return to full resistive exercise plan immediately",
      "📝 Log every session — trend accuracy depends on it",
      "🥗 Maintain high-protein nutrition score (>7/10)",
      "🩺 Report back pain or grip loss to crew medical officer",
    ]
  },
  env: {
    label: "Habitat Air (CO₂)", icon: "🌬️",
    improvements: [
      "🌬️ Check CO₂ scrubbers and fan operation immediately",
      "🚶 Move to best-ventilated module in habitat",
      "📋 Log headache, fatigue or slowed thinking symptoms",
      "🚨 Alert crew; follow CO₂ alarm checklist",
    ]
  },
  rad: {
    label: "Radiation", icon: "☢️",
    improvements: [
      "🛡️ Move to storm shelter; minimise open-area exposure",
      "⏱️ Log time in shielded vs unshielded modules",
      "🔍 Monitor for nausea, skin redness, fatigue over 48 h",
      "📡 Contact ground immediately during active SPE",
    ]
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const N = C.days;
const LBL = ["Normal", "Watch", "Act"];
const GLY = ["●", "▲", "■"];
const st  = (s) => s === LEARNING ? "Learning baseline" : LBL[s];
const gl  = (s) => s === LEARNING ? "—" : GLY[s];
const cls = (s) => s === LEARNING ? "sm" : "s" + s;

// ── State ─────────────────────────────────────────────────────────────────────
let mission, ctx, T = 30, SEL = null, timer = null;
let prevStatus = null; // track overall status to trigger sounds

// ── Persistence keys ──────────────────────────────────────────────────────────
const KEY_CI  = "mv-checkins";
const KEY_XP  = "mv-xp";

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const loadObj  = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const saveObj  = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch {} };

// ── XP / Achievement system ───────────────────────────────────────────────────
const LEVELS = [
  { name: "Trainee",          xpMin: 0   },
  { name: "Specialist",       xpMin: 100 },
  { name: "Senior Astronaut", xpMin: 300 },
  { name: "Mission Commander",xpMin: 700 },
];
const ACHIEVEMENTS = {
  iron:    { emoji: "🏅", label: "Iron Routine",   desc: "30-day check-in streak" },
  warn:    { emoji: "📡", label: "Early Warning",  desc: "Opened forecast when it triggered" },
  ground:  { emoji: "📋", label: "Ground Ready",   desc: "Generated ground summary" },
  perfect: { emoji: "⭐", label: "Perfect Week",   desc: "7 consecutive days all Normal" },
};

function getXPState() {
  const d = loadObj(KEY_XP);
  return {
    xp:           d.xp           ?? 0,
    streak:       d.streak       ?? 0,
    lastCheckin:  d.lastCheckin  ?? null,
    achievements: d.achievements ?? {},
  };
}
function saveXPState(s) { saveObj(KEY_XP, s); }

function levelFor(xp) {
  let lv = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xpMin) lv = l;
  return lv;
}
function nextLevel(xp) {
  for (const l of LEVELS) if (l.xpMin > xp) return l;
  return null;
}

function renderXPBar() {
  const s = getXPState();
  const lv  = levelFor(s.xp);
  const nxt = nextLevel(s.xp);
  $("xp-level").textContent = lv.name;
  $("xp-num").textContent   = `${s.xp} XP`;
  const pct = nxt ? Math.round(((s.xp - lv.xpMin) / (nxt.xpMin - lv.xpMin)) * 100) : 100;
  $("xp-bar").style.width = pct + "%";
  // Badges
  const row = $("badges-row");
  row.querySelectorAll(".badge").forEach(b => {
    b.classList.toggle("earned", !!s.achievements[b.dataset.ach]);
  });
}

function awardXP(amount, label) {
  const s = getXPState();
  s.xp += amount;
  saveXPState(s);
  renderXPBar();
  // Flash animation
  const el = document.createElement("div");
  el.className = "xp-flash";
  el.textContent = `+${amount} XP — ${label}`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
  playXP();
}

function unlockAchievement(key) {
  const s = getXPState();
  if (s.achievements[key]) return false;
  s.achievements[key] = true;
  saveXPState(s);
  renderXPBar();
  return true;
}

function recordCheckin(day) {
  const s = getXPState();
  const today = `d${day}`;
  if (s.lastCheckin === today) return; // already logged today
  // Streak
  const ci = loadObj(KEY_CI);
  let streak = 1;
  // Count consecutive days with check-ins up to and including this day
  for (let d = day - 1; d >= 1; d--) {
    if (ci[d]) streak++; else break;
  }
  s.streak     = streak;
  s.lastCheckin = today;
  saveXPState(s);

  awardXP(10, "Daily check-in");
  if (streak > 0 && streak % 7 === 0) awardXP(5, "7-day streak bonus");
  if (streak >= 30 && unlockAchievement("iron"))   awardXP(50, "Iron Routine unlocked!");
}

function checkPerfectWeek(a) {
  const allNormal = Object.values(a.domains).every(d => Math.max(0, d.status) === 0);
  if (allNormal) {
    const s = getXPState();
    s._perfectDays = (s._perfectDays || 0) + 1;
    if (s._perfectDays >= 7 && unlockAchievement("perfect")) awardXP(50, "Perfect Week!");
    saveXPState(s);
  } else {
    const s = getXPState(); s._perfectDays = 0; saveXPState(s);
  }
}

// ── Check-in application ──────────────────────────────────────────────────────
function applyCheckins() {
  const c = loadObj(KEY_CI);
  for (const day in c) for (const k in c[day]) {
    if (mission.series[k]) mission.series[k][day - 1] = c[day][k];
  }
}

// ── Sparkline (mini chart for card) ──────────────────────────────────────────
function spark(dm, t) {
  const w = 200, h = 46;
  const ks = Object.keys(C.metrics).filter(k => C.metrics[k].domain === dm);
  const pts = [];
  for (let d = 1; d <= t; d++) {
    const m = Math.max(...ks.map(k => ctx.drift[k][d - 1]));
    pts.push(`${((d / N) * w).toFixed(1)},${(h - 2 - (Math.min(Math.max(m, 0), 3.5) / 3.5) * (h - 4)).toFixed(1)}`);
  }
  const y = v => h - 2 - (v / 3.5) * (h - 4);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="${w}" y1="${y(C.amber)}" y2="${y(C.amber)}" stroke="var(--wn)" stroke-dasharray="3 3" opacity=".6"/>
    <line x1="0" x2="${w}" y1="${y(C.red)}"   y2="${y(C.red)}"   stroke="var(--bd)" stroke-dasharray="3 3" opacity=".6"/>
    <polyline fill="none" stroke="var(--ac)" stroke-width="2" points="${pts.join(" ")}"/></svg>`;
}

// ── Trend chart (detail panel) ─────────────────────────────────────────────
function trendChart(dm, t) {
  const ks     = Object.keys(C.metrics).filter(k => C.metrics[k].domain === dm && k !== "dose");
  const W = 560, H = 160, PAD = { top: 16, right: 24, bottom: 32, left: 36 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top  - PAD.bottom;
  const startDay = Math.max(1, t - 13);
  const days = t - startDay + 1; // 1..14

  // find drift range
  let dMin = 0, dMax = 2.8;
  ks.forEach(k => {
    for (let d = startDay; d <= t; d++) dMax = Math.max(dMax, ctx.drift[k][d-1]);
  });
  dMax = Math.min(dMax + 0.3, 4.5);

  const xOf = (d) => PAD.left + ((d - startDay) / Math.max(days - 1, 1)) * iw;
  const yOf = (v) => PAD.top  + ih - ((v - dMin) / (dMax - dMin)) * ih;

  const COLORS = ["var(--ac)", "var(--ok)", "var(--wn)", "var(--xp)", "#5cd6d6", "#ff9e5e"];

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Grid lines
  for (let v = 0; v <= dMax; v += 0.5) {
    const yy = yOf(v).toFixed(1);
    if (yy < PAD.top || yy > PAD.top + ih) continue;
    svg += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yy}" y2="${yy}" stroke="var(--ln)" stroke-width="0.5" opacity=".5"/>`;
    svg += `<text x="${PAD.left - 4}" y="${+yy + 4}" text-anchor="end" font-size="9" fill="var(--mu)">${v.toFixed(1)}</text>`;
  }

  // Amber / Red threshold lines
  const ya = yOf(C.amber).toFixed(1);
  const yr = yOf(C.red).toFixed(1);
  svg += `<line x1="${PAD.left}" x2="${W-PAD.right}" y1="${ya}" y2="${ya}" stroke="var(--wn)" stroke-dasharray="5 3" stroke-width="1.2"/>`;
  svg += `<text x="${W - PAD.right + 2}" y="${+ya + 4}" font-size="9" fill="var(--wn)">Watch</text>`;
  if (yr >= PAD.top) {
    svg += `<line x1="${PAD.left}" x2="${W-PAD.right}" y1="${yr}" y2="${yr}" stroke="var(--bd)" stroke-dasharray="5 3" stroke-width="1.2"/>`;
    svg += `<text x="${W - PAD.right + 2}" y="${+yr + 4}" font-size="9" fill="var(--bd)">Act</text>`;
  }

  // Day labels on x-axis
  for (let d = startDay; d <= t; d++) {
    if ((d - startDay) % 3 === 0 || d === t) {
      const xx = xOf(d).toFixed(1);
      svg += `<text x="${xx}" y="${PAD.top + ih + 14}" text-anchor="middle" font-size="9" fill="var(--mu)">D${d}</text>`;
    }
  }

  // Current day marker
  const xCur = xOf(t).toFixed(1);
  svg += `<line x1="${xCur}" x2="${xCur}" y1="${PAD.top}" y2="${PAD.top+ih}" stroke="var(--ac)" stroke-width="1" opacity=".5" stroke-dasharray="4 3"/>`;

  // Per-metric lines + dots
  ks.forEach((k, ki) => {
    const col = COLORS[ki % COLORS.length];
    const pts = [];
    for (let d = startDay; d <= t; d++) {
      const v = ctx.drift[k][d - 1];
      if (v != null) pts.push([xOf(d), yOf(Math.min(Math.max(v, dMin), dMax))]);
    }
    if (pts.length < 2) return;
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    svg += `<path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>`;
    // dots
    pts.forEach(([px, py], i) => {
      const isLast = i === pts.length - 1;
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${isLast ? 4 : 2.5}" fill="${col}" opacity="${isLast ? 1 : 0.7}"/>`;
    });
  });

  svg += `</svg>`;

  // Legend
  const legend = ks.map((k, ki) => {
    const col = COLORS[ki % COLORS.length];
    return `<span class="chart-legend-item"><span class="chart-legend-swatch" style="background:${col}"></span>${C.metrics[k].name}</span>`;
  }).join("");

  return `<div class="chart-wrap">${svg}<div class="chart-legend">${legend}</div></div>`;
}

// ── Health ring gauge ─────────────────────────────────────────────────────────
function updateRing(status, tier) {
  const fill = $("ring-fill");
  const circ = 2 * Math.PI * 34; // ≈213.6
  let pct, color;
  if (status === LEARNING) { pct = 0.5; color = "var(--na)"; }
  else if (status === 0)   { pct = 1.0; color = "var(--ok)"; }
  else if (status === 1)   { pct = 0.6; color = "var(--wn)"; }
  else                     { pct = 0.25; color = "var(--bd)"; }
  fill.setAttribute("stroke-dashoffset", (circ * (1 - pct)).toFixed(1));
  fill.setAttribute("stroke", color);
}

// ── Body map coloring ─────────────────────────────────────────────────────────
function updateBodyMap(domains) {
  const statusColor = s => s === LEARNING ? "var(--na)" : s === 0 ? "var(--ok)" : s === 1 ? "var(--wn)" : "var(--bd)";
  document.querySelectorAll("#body-map .body-region").forEach(g => {
    const dm = g.dataset.domain;
    if (!dm || !domains[dm]) return;
    const s = domains[dm].status;
    g.querySelectorAll("ellipse, rect, path, circle").forEach(el => {
      if (!el.classList.contains("static")) el.setAttribute("fill", statusColor(s));
    });
    g.style.color = statusColor(s);
  });
  // Legend dots
  updateDomainLegend(domains);
}

function updateDomainLegend(domains) {
  const leg = $("domain-legend");
  if (!leg) return;
  const statusColor = s => s === LEARNING ? "var(--na)" : s === 0 ? "var(--ok)" : s === 1 ? "var(--wn)" : "var(--bd)";
  leg.innerHTML = Object.keys(C.domains).map(dm => {
    const s = domains[dm].status;
    return `<div class="domain-legend-item${SEL === dm ? " active" : ""}" data-dm="${dm}">
      <span class="dom-dot" style="background:${statusColor(s)}"></span>
      <span>${C.domains[dm]}</span>
    </div>`;
  }).join("");
  leg.querySelectorAll(".domain-legend-item").forEach(el => {
    el.addEventListener("click", () => { SEL = el.dataset.dm; render(); });
  });
}

// ── Crew Ripple synthetic data ────────────────────────────────────────────────
const CREW_MEMBERS = [
  { id: "A", name: "CDR Alpha",   offset: { hr: 0,  slp: 0,  mood: 0,   stress: 0,  co2: 0   } },
  { id: "B", name: "PLT Bravo",   offset: { hr: 8,  slp: -1, mood: -2,  stress: 1.5,co2: 0   } },
  { id: "C", name: "MS Charlie",  offset: { hr: 2,  slp: -0.5,mood: -1, stress: 0.5,co2: 0   } },
  { id: "D", name: "MS Delta",    offset: { hr: 3,  slp: 0.5,mood: 1,   stress: -0.5,co2: 0.5} },
];

function syntheticCrewAnalysis(t) {
  return CREW_MEMBERS.map(cr => {
    // Build a simple synthetic series by offsetting baselines
    const seriesCopy = {};
    for (const k in mission.series) {
      seriesCopy[k] = mission.series[k].map((v, i) => {
        if (v == null) return null;
        const off = cr.offset[k] ?? 0;
        return v + off * (0.5 + Math.sin(i * 0.1 + cr.id.charCodeAt(0)) * 0.5);
      });
    }
    const c2 = prepare(seriesCopy);
    const a2 = analyze(c2, t);
    return { cr, a: a2 };
  });
}

function renderCrewModal(t) {
  const crew = syntheticCrewAnalysis(t);
  const statusColor = s => s === LEARNING ? "var(--na)" : s === 0 ? "var(--ok)" : s === 1 ? "var(--wn)" : "var(--bd)";
  $("crew-grid").innerHTML = crew.map(({ cr, a }) => {
    const rows = Object.keys(C.domains).map(dm => {
      const d = a.domains[dm]; const s = d.status;
      return `<div class="crew-status-row"><span>${C.domains[dm]}</span>
        <strong style="color:${statusColor(s)}">${gl(s)} ${st(s)}</strong></div>`;
    }).join("");
    const o = a.overall;
    return `<div class="crew-card">
      <h4>${cr.name}</h4>
      <div style="font-size:1.1rem;font-weight:700;color:${statusColor(o.status)};margin-bottom:8px">${gl(o.status)} ${["Ready","Watch closely","Act now"][Math.max(0,o.status)] || "Learning"}</div>
      ${rows}
    </div>`;
  }).join("");
}

// ── Educational modal ─────────────────────────────────────────────────────────
function showEduModal(dm) {
  const edu = C.domainEdu[dm];
  if (!edu) return;
  $("edu-title").textContent = `ⓘ ${edu.title}`;
  $("edu-about").textContent = edu.about;
  $("edu-nasa").textContent  = edu.nasa;
  $("edu-tiers").innerHTML   = edu.tiers.map(t => `<li>${t}</li>`).join("");

  // Source links
  const srcEl = $("edu-sources");
  if (srcEl) {
    const links = [];
    if (edu.source)    links.push(`<a href="${edu.source.url}" target="_blank" rel="noopener">📖 ${edu.source.label}</a>`);
    if (edu.csaSource) links.push(`<a href="${edu.csaSource.url}" target="_blank" rel="noopener">🍁 ${edu.csaSource.label}</a>`);
    srcEl.innerHTML = links.length ? `<div class="edu-sources-label">Sources</div>` + links.join("") : "";
  }

  $("edu-modal").showModal();
}

// ── li helper ─────────────────────────────────────────────────────────────────
const li = (a) => a.map(x => `<li>${x}</li>`).join("");

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  const t = T;
  const a = analyze(ctx, t);
  const D = a.domains;
  const order = Object.keys(D).sort((x, y) => Math.max(0, D[y].status) - Math.max(0, D[x].status) || D[y].score - D[x].score);

  // Day label & phase badge
  $("dl").textContent = `Day ${t} of ${N}`;
  const ph = $("ph");
  if (a.adapting) {
    ph.textContent = "Adaptation window";
    ph.className = "phase-badge adapt";
  } else if (a.spe) {
    ph.textContent = "☢ Solar Particle Event";
    ph.className = "phase-badge spe";
  } else {
    const phaseName = t < 60 ? "Outbound cruise" : t < 120 ? "Deep space" : "Return approach";
    ph.textContent = phaseName;
    ph.className = "phase-badge";
  }
  $("sl").value = t;

  // Health ring + overall
  const o = a.overall;
  updateRing(o.status, o.tier);

  if (a.adapting) {
    $("ov").innerHTML = `<span class="sm">Learning baseline</span>`;
    $("ovs").textContent = "Days 1–7 are an adaptation window. Alerts start on day 8.";
  } else {
    $("ov").innerHTML = `<span class="${cls(o.status)}">${gl(o.status)} ${["Ready","Watch closely","Act now"][o.status]}</span>`;
    $("ovs").textContent = ["All indicators near your personal baseline.",
      "Tier 1: self-manage and recheck in 24 h.",
      "Tier 2: involve the crew medical officer.",
      "Tier 3: contact ground now and send the summary."][o.tier];
  }

  const wd = o.worstDomain, ws = D[wd].status;
  $("na").textContent = ws >= 1
    ? `${C.actions[wd][ws === 2 ? 1 : 0][0]} (${C.domains[wd]})`
    : "Keep your routine and log your daily check-in.";

  // Top concerns
  const top = order.filter(d => D[d].status >= 1).slice(0, 3);
  $("tc").innerHTML = top.length
    ? "<ul>" + top.map(d => `<li><strong class="${cls(D[d].status)}">${C.domains[d]}</strong>: ${reasonLines(ctx, a, d, 1)[0] || "Drifting from baseline"}</li>`).join("") + "</ul>"
    : `<span class="mu">No concerns right now.</span>`;

  // Forecast
  const f = a.forecast;
  if (f) {
    // Early Warning achievement
    if (unlockAchievement("warn")) awardXP(25, "Early Warning unlocked!");
  }
  $("fc").innerHTML = f
    ? `At current trend, <strong>${f.name}</strong> reaches Watch in ~${f.days} day${f.days > 1 ? "s" : ""}. Act now to avoid it.`
    : `<span class="mu">No indicator trending toward Watch right now.</span>`;

  // Banner
  $("bn").innerHTML = a.spe
    ? `<div class="banner" role="alert">☢ Solar particle event (${a.spe.dose.toFixed(1)} mSv/day): move to the shielded shelter now.</div>`
    : "";

  // Sound: compare to previous status
  if (prevStatus !== null && !a.adapting) {
    if (o.status < prevStatus) playChime();
    else if (o.status > prevStatus) playWarn();
  }
  prevStatus = a.adapting ? null : o.status;

  // Domain cards grid
  $("gr").innerHTML = Object.keys(C.domains).map(d => {
    const s = D[d].status;
    const extra = d === "rad"
      ? `<div class="bar"><i style="width:${Math.min(100, (a.cumDose / C.radiation.missionLimitmSv) * 100)}%"></i></div>
         <div class="mu">${a.cumDose.toFixed(0)} of ${C.radiation.missionLimitmSv} mSv</div>`
      : `<div class="mu">Confidence ${Math.round(D[d].confidence * 100)}%</div>`;
    return `<button class="panel card ${cls(s)}${SEL === d ? " sel" : ""}" data-d="${d}" aria-label="${C.domains[d]}: ${st(s)}">
      <button class="info-btn" data-edu="${d}" title="Learn about ${C.domains[d]}" aria-label="Info: ${C.domains[d]}">ⓘ</button>
      <div class="nm">${C.domains[d]}</div>
      <div class="chip ${cls(s)}">${gl(s)} ${st(s)}</div>
      ${extra}${spark(d, t)}
    </button>`;
  }).join("");

  document.querySelectorAll(".card").forEach(c => {
    c.onclick = (e) => {
      // prevent info button from triggering card select
      if (e.target.classList.contains("info-btn")) return;
      SEL = c.dataset.d; render();
    };
  });
  document.querySelectorAll(".info-btn").forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); showEduModal(b.dataset.edu); };
  });

  // Body map coloring
  updateBodyMap(D);

  // Body map SVG: highlight selected region
  document.querySelectorAll("#body-map .body-region").forEach(g => {
    g.classList.toggle("sel-region", g.dataset.domain === SEL);
  });

  // Detail panel
  const dm = SEL || wd;
  const x  = D[dm];
  const rs = reasonLines(ctx, a, dm, 2);
  const cs = a.contributors.filter(c => c.domain === dm || (dm === "beh" && /Habitat/.test(c.text)));
  const rows = x.indicators.map(i =>
    `<tr><td>${i.name}</td><td>${formatValue(C, i.key, i.value)}</td>
     <td>${i.baseline.toFixed(C.metrics[i.key].dec)}</td>
     <td><span class="dr" style="width:${Math.min(60, Math.max(2, i.drift * 20))}px"></span> ${i.drift.toFixed(1)}</td></tr>`
  ).join("");
  const n = Math.round(x.confidence * 7 * x.indicators.length);

  let tiers = "";
  if (x.status >= 1) {
    tiers = `<h3>What to do</h3><strong>Tier 1 — self-manage</strong><ul>${li(C.actions[dm][0])}</ul>`;
    if (x.status === 2) tiers += `<strong>Tier 2 — crew medical officer</strong><ul>${li(C.actions[dm][1])}</ul>`;
    if (x.rule === "infection" || x.rule === "spe" || o.tier === 3)
      tiers += `<strong class="s2">Tier 3 — contact ground now</strong><ul><li>Open Ground summary and transmit.</li></ul>`;
  }

  $("dt").innerHTML =
    `<h2>Explain: ${C.domains[dm]} <span class="${cls(x.status)}">${gl(x.status)} ${st(x.status)}</span>
      <button class="info-btn" style="position:static;margin-left:8px" data-edu="${dm}">ⓘ</button></h2>` +
    (x.status === LEARNING
      ? `<p class="mu">Not enough data yet — alerts start after the adaptation window.</p>`
      : `<p>${rs.length ? "Why: " + rs.join("; ") + "." : "Everything is close to your personal baseline."} Confidence ${Math.round(x.confidence * 100)}% (${n} of ${7 * x.indicators.length} readings in the last 7 days).</p>`) +
    (cs.length ? `<ul>${li(cs.map(c => c.text))}</ul>` : "") +
    trendChart(dm, t) +
    `<table><tr><th>Indicator</th><th>Now</th><th>Baseline</th><th>Drift</th></tr>${rows}</table>` +
    tiers;

  $("dt").querySelectorAll(".info-btn").forEach(b => {
    b.onclick = () => showEduModal(b.dataset.edu);
  });

  // Perfect week check
  checkPerfectWeek(a);

  // Sync 3D body scan zones
  update3DBody(a);
}

function recompute() { ctx = prepare(mission.series); render(); }

// ── Check-in dialog ───────────────────────────────────────────────────────────
const CHECKIN_FIELDS = [
  { k: "fat",       label: "Fatigue",                          min: 0, max: 10, step: 1,   edu: null },
  { k: "mood",      label: "Mood (0 low, 10 great)",           min: 0, max: 10, step: 1,   edu: null },
  { k: "stress",    label: "Stress (0 calm, 10 high)",         min: 0, max: 10, step: 1,   edu: null },
  { k: "slp",       label: "Sleep last night (hours)",         min: 0, max: 12, step: 0.5, edu: null },
  { k: "sbp",       label: "Blood pressure systolic (mmHg)",   min: 90, max: 180, step: 1, edu: "Systolic blood pressure is the pressure in your arteries when your heart beats. In space, fluid shifts toward the head can raise it." },
  { k: "dbp",       label: "Blood pressure diastolic (mmHg)",  min: 60, max: 120, step: 1, edu: "Diastolic pressure is the pressure between heartbeats. Persistent changes signal cardiovascular stress." },
  { k: "hydration", label: "Hydration (glasses of water)",     min: 0, max: 10, step: 1,   edu: "Without gravity-driven thirst cues, astronauts often under-hydrate. Kidney stones are a known spaceflight risk." },
  { k: "nutrition", label: "Nutrition score (0–10)",           min: 0, max: 10, step: 1,   edu: "Adequate nutrition is essential to slow muscle and bone loss in microgravity. Aim for protein-rich meals." },
  { k: "headache",  label: "Headache severity (0–10)",         min: 0, max: 10, step: 1,   edu: "Headaches in space are often caused by fluid shifts, CO2 buildup, or disrupted sleep." },
];

function openCheckin() {
  $("cf").innerHTML = CHECKIN_FIELDS.map(({ k, label, min, max, step, edu }) => {
    const def = mission.series[k]
      ? (mission.series[k][T - 1] ?? (ctx.base[k] ? +ctx.base[k].mean.toFixed(1) : min))
      : min;
    const infoBtn = edu ? `<span class="field-info-btn" data-tip="${edu}" title="${edu}">ⓘ</span>` : "";
    return `<label for="f_${k}">${label}${infoBtn}: <strong id="v_${k}" style="color:var(--ac)">${def}</strong></label>
      <div class="field-row">
        <input id="f_${k}" type="range" min="${min}" max="${max}" step="${step}" value="${def}">
        <span class="field-val" id="fv_${k}">${def}</span>
      </div>`;
  }).join("");

  CHECKIN_FIELDS.forEach(({ k }) => {
    const inp = $("f_" + k), val = $("v_" + k), fv = $("fv_" + k);
    if (!inp) return;
    inp.oninput = () => { val.textContent = inp.value; fv.textContent = inp.value; };
  });

  // Info tooltips
  $("cf").querySelectorAll(".field-info-btn").forEach(el => {
    el.onclick = () => {
      alert(el.dataset.tip); // Simple inline tip; can be a modal if desired
    };
  });

  $("cd").showModal();
}

function saveCheckin() {
  const c = loadObj(KEY_CI);
  c[T] = {};
  CHECKIN_FIELDS.forEach(({ k }) => {
    const inp = $("f_" + k);
    if (!inp) return;
    const v = +inp.value;
    c[T][k] = v;
    if (mission.series[k]) mission.series[k][T - 1] = v;
  });
  saveObj(KEY_CI, c);
  recordCheckin(T);
  $("cd").close();
  recompute();
}

// ── Body map interactions ─────────────────────────────────────────────────────
function setupBodyMap() {
  const tooltip = $("body-tooltip");
  document.querySelectorAll("#body-map .body-region").forEach(g => {
    const dm = g.dataset.domain;
    if (!dm) return;
    g.addEventListener("mouseenter", (e) => {
      tooltip.textContent = C.domains[dm];
      tooltip.style.display = "block";
    });
    g.addEventListener("mousemove", (e) => {
      tooltip.style.left = (e.clientX + 12) + "px";
      tooltip.style.top  = (e.clientY - 28) + "px";
    });
    g.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
    g.addEventListener("click", () => { SEL = dm; render(); });
  });
}

// ── Mute button ───────────────────────────────────────────────────────────────
function setupMute() {
  const btn = $("mute-btn");
  btn.onclick = () => {
    const m = !isMuted();
    setMuted(m);
    btn.textContent = m ? "🔇" : "🔊";
    btn.title = m ? "Sound muted — click to unmute" : "Toggle sound alerts";
  };
}

// ── Crew modal ────────────────────────────────────────────────────────────────
function setupCrewModal() {
  $("crew-btn").onclick = () => { renderCrewModal(T); $("crew-modal").showModal(); };
  $("crew-close").onclick = () => $("crew-modal").close();
}

// ── Ground summary ────────────────────────────────────────────────────────────
function setupGroundSummary() {
  $("gs").onclick = () => {
    $("gt").textContent = groundSummary(ctx, T);
    $("cm").textContent = "";
    $("dg").showModal();
    if (unlockAchievement("ground")) awardXP(25, "Ground Ready unlocked!");
  };
  $("cl").onclick = () => $("dg").close();
  $("cp").onclick = async () => {
    try { await navigator.clipboard.writeText($("gt").textContent); $("cm").textContent = "Copied!"; }
    catch { $("cm").textContent = "Select the text above and copy manually."; }
  };
}

// ── Jump markers ─────────────────────────────────────────────────────────────
const JUMPS = [
  [30, "D30 baseline"], [64, "D64 forecast"], [67, "D67 infection"],
  [93, "D93 CO2"], [121, "D121 solar"], [140, "D140 bone"], [178, "D178 mood"],
];

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  mission = await (await fetch("data/mission.json")).json();

  // Ensure new metric arrays exist (nulls) in the mission series
  const newMetrics = ["sbp", "dbp", "hydration", "nutrition", "headache"];
  newMetrics.forEach(k => {
    if (!mission.series[k]) mission.series[k] = new Array(N).fill(null);
  });

  applyCheckins();
  ctx = prepare(mission.series);

  // Timeline slider
  $("sl").oninput = e => { T = +e.target.value; render(); };

  // Play button
  $("pl").onclick = e => {
    if (timer) { clearInterval(timer); timer = null; e.target.textContent = "▶ Play"; return; }
    e.target.textContent = "⏸ Pause";
    timer = setInterval(() => {
      if (T >= N) { clearInterval(timer); timer = null; $("pl").textContent = "▶ Play"; return; }
      T++; render();
    }, 140);
  };

  // Jump markers
  const jm = $("jm");
  JUMPS.forEach(([d, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => { T = d; SEL = null; render(); };
    jm.appendChild(b);
  });

  // Check-in dialog
  $("ci").onclick = openCheckin;
  $("cs").onclick = saveCheckin;
  $("cx").onclick = () => $("cd").close();

  // Edu modal
  $("edu-close").onclick = () => $("edu-modal").close();

  setupGroundSummary();
  setupBodyMap();
  setupMute();
  setupCrewModal();
  setup3DBody();

  // Initial render & XP bar
  renderXPBar();
  render();

  // Service worker
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ── 3D body scan setup ────────────────────────────────────────────────────────
function setup3DBody() {
  const canvas = $("body3d-canvas");
  if (!canvas) return;

  // Init Three.js viewer; pass callback for zone clicks
  initBody3D(canvas, (domainId) => {
    SEL = domainId;
    render();
    showImprovementsPanel(domainId);
  });

  // Build zone legend
  buildZoneLegend();

  // Dismiss button
  const dismiss = $("impv-dismiss");
  if (dismiss) dismiss.onclick = () => {
    $("improvements-panel").style.display = "none";
  };
}

// Build the colour-coded legend under the canvas
function buildZoneLegend() {
  const leg = $("zone-legend");
  if (!leg) return;
  const domains = { imm: "Immune", msk: "Bone & Muscle", car: "Heart", beh: "Mind", env: "Air", rad: "Radiation" };
  leg.innerHTML = Object.entries(domains).map(([id, name]) =>
    `<div class="zone-pill" data-zone="${id}">
      <span class="zone-dot" id="zdot-${id}" style="background:#7a90aa"></span>
      ${name}
    </div>`
  ).join("");
}

// Called from render() to sync 3D zone colours + improvements panel
function update3DBody(analysis) {
  if (!analysis) return;
  const statusMap = {};
  const colorMap  = { "-1": "#5ca8ff", 0: "#3ecf84", 1: "#f5be45", 2: "#ff4444" };
  for (const dm in analysis.domains) {
    statusMap[dm] = Math.max(-1, analysis.domains[dm].status ?? -1);
    // Update legend dot colour
    const dot = document.getElementById("zdot-" + dm);
    if (dot) dot.style.background = colorMap[String(statusMap[dm])] ?? "#7a90aa";
  }
  // Push status to Three.js viewer
  try { body3dUpdateStatus(statusMap); } catch (_) {}

  // Auto-show improvements panel for the worst-status domain
  const worst = analysis.overall?.worstDomain;
  const worstStatus = worst ? (analysis.domains[worst]?.status ?? -1) : -1;
  if (worstStatus >= 1) {
    showImprovementsPanel(worst, worstStatus);
  } else {
    const panel = $("improvements-panel");
    if (panel) panel.style.display = "none";
  }
}

// Render the improvements panel for a given domain
function showImprovementsPanel(domainId, status) {
  const panel = $("improvements-panel");
  if (!panel) return;
  const info = ZONE_IMPROVEMENTS[domainId];
  if (!info) return;

  // Determine status from current analysis if not passed
  let s = status;
  if (s === undefined && ctx) {
    const a = analyze(ctx, T);
    s = a.domains[domainId]?.status ?? -1;
  }
  if (s < 1) { panel.style.display = "none"; return; }

  $("impv-icon").textContent   = info.icon;
  $("impv-title").textContent  = info.label;
  const statusEl = $("impv-status");
  if (s === 2) {
    statusEl.textContent  = "■ Act Now — involve crew medical officer";
    statusEl.className    = "impv-status s2";
  } else {
    statusEl.textContent  = "▲ Watch Closely — self-manage and recheck";
    statusEl.className    = "impv-status s1";
  }
  $("impv-list").innerHTML = info.improvements
    .map(t => `<li class="${s === 1 ? "warn-item" : ""}">${t}</li>`)
    .join("");
  panel.style.display = "block";
}

init();
