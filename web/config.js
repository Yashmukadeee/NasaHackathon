// All thresholds and content live here so a flight surgeon can review them
// without touching code. Values are PLACEHOLDERS, not clinical limits.
export const CONFIG = {
  days: 180,
  adaptationDays: 7,                 // no alerts during microgravity adaptation
  baseline: { start: 8, end: 30 },   // stand-in for a pre-flight baseline
  ewmaLambda: 0.3,
  amber: 1.3,                        // drift (in personal SD units) for Watch
  red: 2.3,                          // drift for Act
  persistence: 2,                    // days a level must hold before it counts
  sdFloor: 0.6,                      // baseline SD never below 0.6 x nominal SD
  immuneTightFactor: 0.75,           // tighter immune thresholds after a solar event
  radiation: {
    missionLimitmSv: 1000,           // configurable; cite source when reviewed
    speDoseThreshold: 5,             // mSv/day that counts as a solar particle event
    speActiveDays: 2,
    speWatchDays: 14,
    cumulativeWatchFraction: 0.5,
  },
  forecast: { windowDays: 5, minSlope: 0.12, minDrift: 0.5, maxHorizonDays: 10 },
  // dir: +1 means higher is worse, -1 means lower is worse
  metrics: {
    temp:   { name: "Resting temperature", unit: "°C",      domain: "imm", dir: 1,  sd: 0.15, dec: 2 },
    fat:    { name: "Fatigue",             unit: "/10",     domain: "imm", dir: 1,  sd: 0.6,  dec: 1 },
    hr:     { name: "Resting heart rate",  unit: "bpm",     domain: "car", dir: 1,  sd: 2,    dec: 0 },
    hrv:    { name: "HRV",                 unit: "ms",      domain: "car", dir: -1, sd: 5,    dec: 0 },
    ex:     { name: "Exercise",            unit: "min",     domain: "msk", dir: -1, sd: 12,   dec: 0 },
    grip:   { name: "Grip strength",       unit: "kg",      domain: "msk", dir: -1, sd: 1,    dec: 1 },
    slp:    { name: "Sleep",               unit: "h",       domain: "beh", dir: -1, sd: 0.5,  dec: 1 },
    mood:   { name: "Mood",                unit: "/10",     domain: "beh", dir: -1, sd: 0.6,  dec: 1 },
    stress: { name: "Stress",              unit: "/10",     domain: "beh", dir: 1,  sd: 0.6,  dec: 1 },
    co2:    { name: "Cabin CO2",           unit: "mmHg",    domain: "env", dir: 1,  sd: 0.3,  dec: 1 },
    dose:   { name: "Radiation dose",      unit: "mSv/day", domain: "rad", dir: 1,  sd: 0.1,  dec: 2 },
  },
  domains: {
    imm: "Immune", msk: "Bone and muscle", car: "Heart",
    beh: "Mind and mood", env: "Habitat air", rad: "Radiation",
  },
  // [tier1 self-manage, tier2 crew medical officer]. No drug doses by design.
  actions: {
    imm: [["Rest, hydrate, and log temperature every 6 hours.", "Lower workload where possible.", "Keep distance from crew if you have fever or cough."],
          ["Crew medical officer: record full vitals and symptoms.", "Check kit options with your medical protocol; do not self-dose from this app.", "Recheck in 6 hours."]],
    msk: [["Return to your full exercise plan, resistive work first.", "Log every session so the trend stays reliable."],
          ["Crew medical officer: review exercise hardware and missed sessions.", "Report new back pain or grip loss to ground."]],
    car: [["Hydrate, rest, and repeat resting heart rate tomorrow morning.", "Add light aerobic work if allowed."],
          ["Crew medical officer: measure blood pressure; note head fullness or dizziness.", "Recheck in 6 hours."]],
    beh: [["Do the sleep wind-down: dim lights, no screens for 1 hour.", "Schedule a private call or crew social time."],
          ["Tell the crew medical officer how you feel.", "Ask ground for a behavioral health check-in."]],
    env: [["Check scrubbers and fans; move to a better-ventilated module.", "Log headache or slowed thinking."],
          ["Follow the CO2 alarm checklist and alert the crew.", "Report to ground if levels do not fall."]],
    rad: [["Review the dose plan; keep time in shielded areas.", "Log symptoms for the next 14 days."],
          ["Move to the storm shelter now and stay until cleared.", "Log the time spent in the shelter."]],
  },
};
