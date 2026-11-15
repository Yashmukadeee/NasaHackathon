async function test() {
  try {
    const res = await fetch('http://127.0.0.1:8000/api/v1/analysis/assess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'astra_flight_ops_2026',
      },
      body: JSON.stringify({
        astronaut_id: 'ASTRO-1',
        mission_day: 45,
        vitals: {
          temp: 38.4,
          hr: 96,
          hrv: 22,
          spo2: 95.5,
          sbp: 128,
          dbp: 84,
          slp: 5.0,
          fat: 9,
          ex: 0,
          grip: 32,
          nutrition: 4,
          hydration: 5,
          mood: 3,
          stress: 6,
          headache: 7,
          co2: 2.2,
          dose: 0.35,
        },
        symptoms: ['Fatigue', 'Headache', 'Nausea'],
        notes: 'Astronaut feels feverish and fatigued post EVA prep.',
        api_key: 'astra_flight_ops_2026',
      }),
    });

    console.log('STATUS:', res.status);
    const json = await res.json();
    console.log('TIER:', json.tier, json.tier_label);
    console.log('WORST_DOMAIN:', json.worst_domain, json.worst_domain_name);
    console.log('HAZARD:', json.hazard);
    console.log('PREDICTED_COMMANDS_COUNT:', json.predicted_commands?.length);
    json.predicted_commands?.forEach((cmd, idx) => {
      console.log(`[CMD ${idx+1}] [${cmd.priority}] ${cmd.title}: ${cmd.command}`);
      console.log(`  NASA Rationale: ${cmd.rationale}`);
    });
    console.log('DEVIATIONS_COUNT:', json.deviations?.length);
    console.log('EVIDENCE_CITATIONS_COUNT:', json.evidence_citations?.length);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

test();
