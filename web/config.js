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
    temp:      { name: "Resting temperature",   unit: "°C",      domain: "imm", dir: 1,  sd: 0.15, dec: 2 },
    fat:       { name: "Fatigue",               unit: "/10",     domain: "imm", dir: 1,  sd: 0.6,  dec: 1 },
    hr:        { name: "Resting heart rate",    unit: "bpm",     domain: "car", dir: 1,  sd: 2,    dec: 0 },
    hrv:       { name: "HRV",                   unit: "ms",      domain: "car", dir: -1, sd: 5,    dec: 0 },
    sbp:       { name: "Blood pressure (sys)",  unit: "mmHg",    domain: "car", dir: 1,  sd: 8,    dec: 0,
                 edu: "Systolic blood pressure measures the force of blood on artery walls during heartbeat. In microgravity, fluid shifts towards the head can alter blood pressure patterns, increasing cardiovascular risk over long missions." },
    dbp:       { name: "Blood pressure (dia)",  unit: "mmHg",    domain: "car", dir: 1,  sd: 5,    dec: 0,
                 edu: "Diastolic blood pressure is the arterial pressure between heartbeats. Persistent elevation in space can increase stroke risk, while drops may indicate dehydration from microgravity fluid shifts." },
    ex:        { name: "Exercise",              unit: "min",     domain: "msk", dir: -1, sd: 12,   dec: 0 },
    grip:      { name: "Grip strength",         unit: "kg",      domain: "msk", dir: -1, sd: 1,    dec: 1 },
    nutrition: { name: "Nutrition score",       unit: "/10",     domain: "msk", dir: -1, sd: 1.0,  dec: 1,
                 edu: "Adequate nutrition is critical for maintaining bone density and muscle mass in space. NASA research shows astronauts need protein-rich diets to slow the 1-2% monthly muscle loss in microgravity." },
    slp:       { name: "Sleep",                 unit: "h",       domain: "beh", dir: -1, sd: 0.5,  dec: 1 },
    mood:      { name: "Mood",                  unit: "/10",     domain: "beh", dir: -1, sd: 0.6,  dec: 1 },
    stress:    { name: "Stress",                unit: "/10",     domain: "beh", dir: 1,  sd: 0.6,  dec: 1 },
    headache:  { name: "Headache severity",     unit: "/10",     domain: "beh", dir: 1,  sd: 0.8,  dec: 1,
                 edu: "Headaches are one of the most commonly reported symptoms in space, often caused by intracranial pressure changes from fluid shifts, CO2 buildup, or disrupted sleep-wake cycles." },
    hydration: { name: "Hydration",             unit: "glasses", domain: "imm", dir: -1, sd: 1.5,  dec: 1,
                 edu: "Adequate hydration is critical for kidney health and immune function in space. Without gravity-driven thirst cues, astronauts often become chronically under-hydrated, raising risk of kidney stones." },
    co2:       { name: "Cabin CO2",             unit: "mmHg",    domain: "env", dir: 1,  sd: 0.3,  dec: 1 },
    dose:      { name: "Radiation dose",        unit: "mSv/day", domain: "rad", dir: 1,  sd: 0.1,  dec: 2 },
  },
  domains: {
    imm: "Immune",
    msk: "Bone and muscle",
    car: "Heart",
    beh: "Mind and mood",
    env: "Habitat air",
    rad: "Radiation",
  },
  // Educational descriptions for each domain (NASA HRP context)
  domainEdu: {
    imm: {
      title: "Immune System",
      about: "Tracks temperature, fatigue, and hydration to detect infection or immune dysregulation early.",
      nasa: "Spaceflight causes significant immune dysregulation: T-cell counts drop, latent viruses reactivate, and wound healing slows. Even a mild infection can escalate rapidly when crew medical resources are limited.",
      tiers: ["Tier 1: Rest, hydrate, track temperature every 6 hours.", "Tier 2: Crew medical officer records full vitals and symptoms.", "Tier 3: Contact ground immediately — infection in space can escalate fast."]
    },
    msk: {
      title: "Bone & Muscle",
      about: "Monitors exercise minutes, grip strength, and nutrition to track musculoskeletal health.",
      nasa: "Without gravity loading, astronauts lose 1–2% bone density and up to 20% muscle mass per month. NASA's HRP mandates 2.5 hours of daily resistive exercise to counter this. Early detection of missed sessions prevents cumulative loss.",
      tiers: ["Tier 1: Return to full exercise plan, prioritize resistive training.", "Tier 2: Crew medical officer reviews hardware and missed sessions.", "Tier 3: Report new back pain or grip strength decline to ground."]
    },
    car: {
      title: "Cardiovascular",
      about: "Monitors resting heart rate, HRV, and blood pressure — key indicators of cardiac stress and autonomic regulation.",
      nasa: "Microgravity causes the heart to work less against gravity, leading to deconditioning, orthostatic intolerance, and in long missions, potentially cardiac atrophy. Fluid shifts alter blood pressure and can mask true cardiovascular state.",
      tiers: ["Tier 1: Hydrate, rest, repeat readings at the same time tomorrow.", "Tier 2: Crew medical officer measures blood pressure and checks for dizziness.", "Tier 3: Multiple cardiovascular alerts — ground consultation required."]
    },
    beh: {
      title: "Mind & Mood",
      about: "Tracks sleep, mood, stress, headaches, and fatigue to monitor behavioral health and cognitive performance.",
      nasa: "Isolation, confinement, monotony, and mission risk are known psychological stressors in long-duration spaceflight. NASA's behavioral health program monitors crews for depression, interpersonal conflict, and performance degradation.",
      tiers: ["Tier 1: Sleep hygiene routine; schedule social or private crew time.", "Tier 2: Crew medical officer psychological check-in.", "Tier 3: Request ground behavioral health consultation."]
    },
    env: {
      title: "Habitat Air",
      about: "Monitors cabin CO2 levels. Elevated CO2 can mimic and amplify health problems.",
      nasa: "CO2 at levels as low as 0.5% (5000 ppm) can cause headaches, fatigue, and cognitive impairment in crew. Closed-loop life support must be constantly monitored — CO2 symptoms are easily confused with illness.",
      tiers: ["Tier 1: Check scrubbers and fans; move to better-ventilated module.", "Tier 2: Follow the CO2 alarm checklist; alert all crew.", "Tier 3: Report to ground if CO2 does not fall within 30 minutes."]
    },
    rad: {
      title: "Radiation",
      about: "Tracks daily radiation dose and cumulative mission dose against career limits.",
      nasa: "Beyond Earth's magnetosphere, astronauts receive 200–300× more radiation than on the surface. Acute solar particle events can cause radiation sickness within hours. Cumulative dose raises lifetime cancer and CNS risk.",
      tiers: ["Tier 1: Review time in shielded vs unshielded areas; log symptoms.", "Tier 2: Move to storm shelter; crew medical officer monitors.", "Tier 3: Active solar particle event — shelter now and contact ground."]
    }
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
