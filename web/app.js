import { CONFIG as C } from "./config.js";
import { prepare, analyze, groundSummary, reasonLines, formatValue, LEARNING } from "./engine.js";

const $ = (id) => document.getElementById(id);
const N = C.days, LBL = ["Normal", "Watch", "Act"], GLY = ["●", "▲", "■"];
const st = (s) => (s === LEARNING ? "Learning baseline" : LBL[s]);
const gl = (s) => (s === LEARNING ? "—" : GLY[s]);
const cls = (s) => (s === LEARNING ? "sm" : "s" + s);

let mission, ctx, T = 30, SEL = null, timer = null;
const KEY = "mv-checkins";

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage may be unavailable */ } };

function applyCheckins() {
  const c = load();
  for (const day in c) for (const k in c[day]) mission.series[k][day - 1] = c[day][k];
}

function spark(dm, t) {
  const w = 200, h = 46, pts = [], ks = Object.keys(C.metrics).filter((k) => C.metrics[k].domain === dm);
  for (let d = 1; d <= t; d++) {
    const m = Math.max(...ks.map((k) => ctx.drift[k][d - 1]));
    pts.push(`${((d / N) * w).toFixed(1)},${(h - 2 - (Math.min(Math.max(m, 0), 3.5) / 3.5) * (h - 4)).toFixed(1)}`);
  }
  const y = (v) => h - 2 - (v / 3.5) * (h - 4);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="${w}" y1="${y(C.amber)}" y2="${y(C.amber)}" stroke="var(--wn)" stroke-dasharray="3 3" opacity=".6"/>
    <line x1="0" x2="${w}" y1="${y(C.red)}" y2="${y(C.red)}" stroke="var(--bd)" stroke-dasharray="3 3" opacity=".6"/>
    <polyline fill="none" stroke="var(--ac)" stroke-width="2" points="${pts.join(" ")}"/></svg>`;
}

const li = (a) => a.map((x) => `<li>${x}</li>`).join("");

function render() {
  const t = T, a = analyze(ctx, t), D = a.domains;
  const order = Object.keys(D).sort((x, y) => Math.max(0, D[y].status) - Math.max(0, D[x].status) || D[y].score - D[x].score);
  $("dl").textContent = `Day ${t} of ${N}`;
  $("ph").textContent = a.adapting ? "Adaptation to microgravity" : a.spe ? "Solar particle event" : "Cruise";
  $("sl").value = t;

  const o = a.overall;
  if (a.adapting) { $("ov").innerHTML = '<span class="sm">Learning your baseline</span>'; $("ovs").textContent = "Days 1 to 7 are an adaptation window. Alerts start on day 8."; }
  else {
    $("ov").innerHTML = `<span class="${cls(o.status)}">${gl(o.status)} ${["Ready", "Watch closely", "Act now"][o.status]}</span>`;
    $("ovs").textContent = ["All indicators are near your own normal.", "Tier 1: self-manage and recheck.", "Tier 2: involve the crew medical officer.", "Tier 3: contact ground now and send the summary."][o.tier];
  }
  const wd = o.worstDomain, ws = D[wd].status;
  $("na").textContent = ws >= 1 ? `${C.actions[wd][ws === 2 ? 1 : 0][0]} (${C.domains[wd]})` : "Keep your routine and log your daily check-in.";

  const top = order.filter((d) => D[d].status >= 1).slice(0, 3);
  $("tc").innerHTML = top.length ? "<ul>" + top.map((d) => `<li><strong class="${cls(D[d].status)}">${C.domains[d]}</strong>: ${reasonLines(ctx, a, d, 1)[0] || (d === "rad" ? "Dose spike or high cumulative dose" : "Drifting from baseline")}</li>`).join("") + "</ul>" : '<span class="mu">No concerns right now.</span>';
  const f = a.forecast;
  $("fc").innerHTML = f ? `At the current trend, <strong>${f.name}</strong> reaches Watch in about ${f.days} day${f.days > 1 ? "s" : ""}. Act now to avoid it.` : '<span class="mu">No indicator is trending toward Watch.</span>';

  $("bn").innerHTML = a.spe ? `<div class="banner" role="alert">Solar particle event (${a.spe.dose.toFixed(1)} mSv/day): move to the shielded shelter now and log your time there.</div>` : "";

  $("gr").innerHTML = Object.keys(C.domains).map((d) => {
    const s = D[d].status;
    const extra = d === "rad"
      ? `<div class="bar"><i style="width:${Math.min(100, (a.cumDose / C.radiation.missionLimitmSv) * 100)}%"></i></div><div class="mu">${a.cumDose.toFixed(0)} of ${C.radiation.missionLimitmSv} mSv mission limit</div>`
      : `<div class="mu">Confidence ${Math.round(D[d].confidence * 100)}%</div>`;
    return `<button class="panel card ${cls(s)}${SEL === d ? " sel" : ""}" data-d="${d}"><div class="nm">${C.domains[d]}</div><div class="chip ${cls(s)}">${gl(s)} ${st(s)}</div>${extra}${spark(d, t)}</button>`;
  }).join("");
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => { SEL = c.dataset.d; render(); }));

  const dm = SEL || wd, x = D[dm];
  const rs = reasonLines(ctx, a, dm, 2);
  const cs = a.contributors.filter((c) => c.domain === dm || (dm === "beh" && /Habitat/.test(c.text)));
  const rows = x.indicators.map((i) => `<tr><td>${i.name}</td><td>${formatValue(C, i.key, i.value)}</td><td>${i.baseline.toFixed(C.metrics[i.key].dec)}</td><td><span class="dr" style="width:${Math.min(60, Math.max(2, i.drift * 20))}px"></span> ${i.drift.toFixed(1)}</td></tr>`).join("");
  const n = Math.round(x.confidence * 7 * x.indicators.length);
  let tiers = "";
  if (x.status >= 1) {
    tiers = `<h3>What to do</h3><strong>Tier 1, self-manage</strong><ul>${li(C.actions[dm][0])}</ul>`;
    if (x.status === 2) tiers += `<strong>Tier 2, crew medical officer</strong><ul>${li(C.actions[dm][1])}</ul>`;
    if (x.rule === "infection" || x.rule === "spe" || o.tier === 3) tiers += '<strong class="s2">Tier 3, contact ground now</strong><ul><li>Open Ground summary and send it.</li></ul>';
  }
  $("dt").innerHTML = `<h2>Explain: ${C.domains[dm]} <span class="${cls(x.status)}">${gl(x.status)} ${st(x.status)}</span></h2>` +
    (x.status === LEARNING ? '<p class="mu">Not enough data yet to judge changes.</p>'
      : `<p>${rs.length ? "Why: " + rs.join("; ") + "." : "Everything is close to your own baseline."} Confidence ${Math.round(x.confidence * 100)}% (${n} of ${7 * x.indicators.length} readings in the last 7 days).</p>`) +
    (cs.length ? `<ul>${li(cs.map((c) => c.text))}</ul>` : "") +
    `<table><tr><th>Indicator</th><th>Now</th><th>Your usual</th><th>Drift</th></tr>${rows}</table>` + tiers;
}

function recompute() { ctx = prepare(mission.series); render(); }

async function init() {
  mission = await (await fetch("data/mission.json")).json();
  applyCheckins();
  ctx = prepare(mission.series);
  $("sl").oninput = (e) => { T = +e.target.value; render(); };
  $("pl").onclick = (e) => {
    if (timer) { clearInterval(timer); timer = null; e.target.textContent = "Play"; return; }
    e.target.textContent = "Pause";
    timer = setInterval(() => { if (T >= N) { clearInterval(timer); timer = null; $("pl").textContent = "Play"; return; } T++; render(); }, 140);
  };
  [[30, "Day 30: baseline"], [64, "Day 64: forecast"], [67, "Day 67: infection"], [93, "Day 93: CO2"], [121, "Day 121: solar event"], [140, "Day 140: bone loading"], [178, "Day 178: mood"]]
    .forEach(([d, label]) => { const b = document.createElement("button"); b.textContent = label; b.onclick = () => { T = d; SEL = null; render(); }; $("jm").appendChild(b); });

  $("gs").onclick = () => { $("gt").textContent = groundSummary(ctx, T); $("cm").textContent = ""; $("dg").showModal(); };
  $("cl").onclick = () => $("dg").close();
  $("cp").onclick = async () => { try { await navigator.clipboard.writeText($("gt").textContent); $("cm").textContent = "Copied."; } catch { $("cm").textContent = "Select the text and copy it."; } };

  const fields = [["fat", "Fatigue (0 none, 10 exhausted)", 0, 10, 1], ["mood", "Mood (0 low, 10 great)", 0, 10, 1], ["stress", "Stress (0 calm, 10 high)", 0, 10, 1], ["slp", "Sleep last night (hours)", 0, 12, 0.5]];
  $("ci").onclick = () => {
    $("cf").innerHTML = fields.map(([k, l, mn, mx, step]) => `<label for="f_${k}">${l}: <strong id="v_${k}"></strong></label><input id="f_${k}" type="range" min="${mn}" max="${mx}" step="${step}" value="${mission.series[k][T - 1] ?? ctx.base[k].mean.toFixed(1)}">`).join("");
    fields.forEach(([k]) => { const i = $("f_" + k), v = $("v_" + k); v.textContent = i.value; i.oninput = () => (v.textContent = i.value); });
    $("cd").showModal();
  };
  $("cx").onclick = () => $("cd").close();
  $("cs").onclick = () => {
    const c = load(); c[T] = {};
    fields.forEach(([k]) => { const v = +$("f_" + k).value; c[T][k] = v; mission.series[k][T - 1] = v; });
    save(c); $("cd").close(); recompute();
  };
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
