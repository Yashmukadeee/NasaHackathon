# Mission Vitals

An offline health self-monitoring app for astronauts on long missions. It learns each astronaut's own normal, flags drift early, explains why, forecasts trouble, and recommends tiered actions. It is **decision support, not diagnosis**, and all data is simulated.

**No ML model, by design.** There is no real labeled flight data, alerts must be explainable, and the engine must run offline. Detection uses personal baselines, z-scores, EWMA drift, persistence checks and a transparent rules layer.

## Run it
Requires Python 3 and Node 18+ (no npm install needed).
```bash
npm run data     # regenerate simulated missions (already included)
npm test         # unit tests
npm run eval     # detection latency, sensitivity, false alarms -> docs/evaluation.md
npm start        # static app + ground bridge at http://localhost:8080
npm run backend  # optional FastAPI service at http://localhost:8000 (Swagger: /docs)
```
The app works fully without the backend (onboard engine + IndexedDB). Start
`npm run backend` as well to enable the NASA research CDSS, wearable gateway,
Supabase sync and ground-team escalation features. Point the app at another API
with `http://localhost:8080/?api=http://127.0.0.1:8000`.

## What you can do in the app
- Scrub or play through a 180-day mission; jump buttons go to the demo moments.
- Six cards: Immune, Bone and muscle, Heart, Mind and mood, Habitat air, Radiation.
- Click a card for the explanation: indicator values vs your usual, drift, confidence, contributing patterns, and Tier 1 / 2 / 3 actions.
- Forecast, solar particle event banner, cumulative dose bar, mission health summary.
- Daily check-in (saved on the device) and a copyable ground summary.
- Works offline once loaded (service worker). Install it as an app from the browser menu.

## Demo script
1. **Day 30**: all Normal; this is the personal baseline.
2. **Day 64**: infection begins; no single value alarms, but the forecast warns.
3. **Day 67**: Act on Immune, infection pattern, Tier 3. Open the ground summary.
4. **Day 93**: CO2 event; habitat pattern says check the air, not just your health.
5. **Day 121**: solar particle event banner; immune thresholds tighten.
6. **Day 140**: bone and muscle flagged from falling exercise and grip.
7. Close with `docs/evaluation.md`.

## Project layout
```
simulator/simulate.py   data generator with scripted anomalies (ground truth)
web/                    static app (index.html, app.js, engine.js, config.js, sw.js, db.js)
server.mjs              static server + /api/v1 ground bridge (npm start)
eval/evaluate.mjs       evaluation harness
tests/                  unit tests
backend/                optional FastAPI service (astronauts, telemetry, analysis,
                        research, alerts, radiation, ground-team, devices, sync)
docs/                   PRD, architecture, evaluation
```
The detection thresholds live in `web/config.js` (frontend) and
`backend/app/services/health_engine.py` (backend); keep the two in step.
Thresholds, indicators and action text are in `web/config.js` so a medical reviewer can edit them without touching code.

## Safety and ethics
No medicine doses are suggested. Data stays on the device unless the astronaut copies the summary. Everything is clearly labeled as simulated decision support.

## Roadmap
Emergency mode, Crew Ripple (compare 4 crew to separate personal illness from habitat problems), reaction-time test, store-and-forward ground queue, vision check, Medical Kit Guide with medical review, real wearable inputs, ML second opinion once real data exists.
