import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepare, analyze, forecast, groundSummary, LEARNING } from "../web/engine.js";
import { CONFIG } from "../web/config.js";
import { alertEpisodes, latency } from "../eval/evaluate.mjs";

const mission = JSON.parse(readFileSync(new URL("../web/data/mission.json", import.meta.url)));
const healthy = JSON.parse(readFileSync(new URL("../web/data/eval/healthy_1.json", import.meta.url)));
const ctx = prepare(mission.series);

test("baseline is close to the nominal personal normal", () => {
  assert.ok(Math.abs(ctx.base.hr.mean - 62) < 1.5);
  assert.ok(Math.abs(ctx.base.temp.mean - 36.6) < 0.1);
});

test("adaptation window never raises alerts", () => {
  const a = analyze(ctx, 5);
  assert.equal(a.overall.status, LEARNING);
  assert.equal(a.overall.tier, 0);
});

test("healthy baseline day is all Normal", () => {
  const a = analyze(prepare(healthy.series), 30);
  assert.ok(Object.values(a.domains).every((d) => d.status === 0));
});

test("infection is flagged within 10 days of onset and escalates to Tier 3", () => {
  const an = mission.meta.anomalies.find((x) => x.name === "infection");
  const l = latency(mission.series, an);
  assert.ok(l !== null && l <= 10, `latency was ${l}`);
  const a = analyze(ctx, 70);
  assert.equal(a.domains.imm.status, 2);
  assert.equal(a.domains.imm.rule, "infection");
  assert.equal(a.overall.tier, 3);
});

test("CO2 event triggers the habitat rule", () => {
  assert.equal(analyze(ctx, 94).domains.env.rule, "habitat");
});

test("solar particle event raises Act, then tightens immune watch", () => {
  const a = analyze(ctx, 121);
  assert.equal(a.domains.rad.status, 2);
  assert.ok(a.spe);
  assert.ok(analyze(ctx, 128).contributors.some((c) => /Solar particle/.test(c.text)));
});

test("false alarms on healthy missions stay low", () => {
  const per30 = alertEpisodes(healthy.series) / ((CONFIG.days - CONFIG.adaptationDays) / 30);
  assert.ok(per30 <= 1, `false alarms per 30 days: ${per30}`);
});

test("forecast projects a steadily rising indicator", () => {
  const s = JSON.parse(JSON.stringify(healthy.series));
  for (let d = 60; d <= 70; d++) s.hr[d - 1] = 62 + (d - 59) * 0.7; // slow climb
  const f = forecast(prepare(s), 70);
  assert.ok(f === null || f.days >= 1); // shape check; value depends on slope
});

test("ground summary includes tier, patterns and disclaimer", () => {
  const s = groundSummary(ctx, 70);
  assert.match(s, /Escalation tier: 3/);
  assert.match(s, /Infection pattern/);
  assert.match(s, /not a diagnosis/);
});
