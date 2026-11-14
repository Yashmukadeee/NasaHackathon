# Architecture

```
simulator/simulate.py  --->  web/data/mission.json        (180 days, with scripted anomalies)
                        \->  web/data/eval/*.json         (20 anomalous + 20 healthy runs)

web/config.js   thresholds, indicators, action text (reviewable by a medical advisor)
web/engine.js   pure analysis functions (browser and Node)
web/app.js      UI: cards, explain panel, check-in, ground summary
web/sw.js       offline cache

eval/evaluate.mjs  --->  docs/evaluation.md
tests/engine.test.mjs    node:test unit tests
```

## Engine pipeline (per mission day)
1. **Baseline**: mean and SD of each indicator over days 8 to 30 (stand-in for a pre-flight baseline). SD is floored at 0.6 x the nominal SD to avoid over-sensitivity.
2. **Z-score**: signed so that positive always means "worse" (`dir` in config). Clamped to +/- 6.
3. **EWMA drift** (lambda 0.3): catches small sustained shifts. Missing days carry the last drift forward; values are never imputed.
4. **Persistence**: a Watch or Act level only counts after it holds for 2 consecutive days.
5. **Domain status**: the worst sustained indicator in the domain. Immune thresholds drop to 75% for 14 days after a solar particle event.
6. **Rules layer**: infection pattern (temperature plus fatigue, heart rate or sleep), habitat pattern (CO2 plus sleep or mood), exercise and grip, solar particle event. Rules can escalate a domain to Act.
7. **Escalation tier**: 1 self-manage, 2 crew medical officer, 3 contact ground (two or more Act domains, infection rule, or solar event).
8. **Forecast**: linear slope of drift over 5 days, projected to the Watch threshold.
9. **Confidence**: share of expected readings present in the last 7 days.

## Data format
`{ meta: {seed, days, anomalies[]}, series: { temp: [day1, day2, ...], ... } }`, with `null` for missing readings. To use real data later, produce the same shape.

## Known limitations
- Baseline is days 8 to 30 of the same dataset, not a true pre-flight measurement.
- Evaluation uses the simulator that also defines the anomalies, so it shows the engine behaves as designed, not that it is clinically valid.
- Thresholds and the radiation limit are placeholders.
- Grip strength loss in the simulator does not recover, to mimic lasting muscle loss.
