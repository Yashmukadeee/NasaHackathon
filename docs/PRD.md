# PRD: Mission Vitals

**Problem.** On long missions, radiation, isolation, altered gravity and a closed habitat cause immune changes, bone and muscle loss, cardiovascular changes and behavioral health problems. With communication delays, astronauts must spot these changes in themselves.

**Goal.** An offline tool that collects health indicators, compares them to the astronaut's own baseline, flags drift early, explains why, and recommends what to do.

**Non-goals.** Diagnosis, drug prescribing, real wearable integration, trained ML models, clinical validation.

**Users.** Primary: a crew member doing a daily check-in. Secondary: crew medical officer and ground flight surgeons (receive the summary).

## Features and status
| ID | Feature | Status |
|---|---|---|
| F1 | Mission simulator with scripted anomalies | Done |
| F2 | Personal baseline, z-score, EWMA drift | Done |
| F3 | Domain status (Normal / Watch / Act) with persistence | Done |
| F4 | Six domain cards with trend charts | Done |
| F5 | Explain-this-alert panel with confidence | Done |
| F6 | Tiered action library (self-manage, crew medical officer, ground) | Done |
| F7 | Ground summary (copy) | Done |
| F8 | Forecast: days until Watch | Done |
| F9 | Radiation module: cumulative dose, solar event banner, tighter immune watch | Done |
| F10 | Cross-domain rules (infection, habitat, exercise) | Done |
| F11 | Mission phase: adaptation window days 1 to 7 | Done |
| F12 | Mission health summary | Done |
| F13 | Daily check-in (local storage) | Done |
| F14 | Offline PWA (service worker, manifest) | Done |
| F15 | Evaluation harness: latency, sensitivity, false alarms | Done |
| Next | Emergency mode, Crew Ripple, reaction-time test, store-and-forward queue, vision check | Planned |
| Future | Medical Kit Guide (needs medical review), what-if simulator, real wearables, ML second opinion | Future |

## Analytics approach
No trained model, by design: no real labeled flight data exists, alerts must be explainable, personal baselines work with little data, and the engine must run offline in a browser.

## Success metrics
Detection latency, sensitivity per scenario, false alarms per 30 days. See `docs/evaluation.md`.

## Risks
Scope creep (freeze features by day 12); circular validation on synthetic data (state openly); unsafe medical advice (suggest only, escalate, editable content); alert fatigue (adaptation window, persistence, confidence).
