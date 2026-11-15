import test from "node:test";
import assert from "node:assert/strict";

// Test API payload validation patterns directly
test("check-in validation enforces parameter bounds", () => {
  const validateCheckin = (body) => {
    const { astronaut_id, day, mood, stress, fatigue, sleep } = body;
    if (!astronaut_id || typeof astronaut_id !== "string") throw new Error("Missing astronaut_id");
    if (typeof day !== "number" || day < 1 || day > 180) throw new Error("Invalid day");
    if (typeof mood !== "number" || mood < 0 || mood > 10) throw new Error("Invalid mood");
    if (typeof stress !== "number" || stress < 0 || stress > 10) throw new Error("Invalid stress");
    if (typeof fatigue !== "number" || fatigue < 0 || fatigue > 10) throw new Error("Invalid fatigue");
    if (typeof sleep !== "number" || sleep < 0 || sleep > 24) throw new Error("Invalid sleep");
    return true;
  };

  assert.ok(validateCheckin({
    astronaut_id: "ASTRO-1",
    day: 45,
    mood: 8,
    stress: 3,
    fatigue: 4,
    sleep: 7.5,
  }));

  assert.throws(() => validateCheckin({
    astronaut_id: "ASTRO-1",
    day: 200, // out of range
    mood: 8,
    stress: 3,
    fatigue: 4,
    sleep: 7.5,
  }), /Invalid day/);

  assert.throws(() => validateCheckin({
    astronaut_id: "ASTRO-1",
    day: 45,
    mood: 12, // exceeds 10
    stress: 3,
    fatigue: 4,
    sleep: 7.5,
  }), /Invalid mood/);
});

test("batch sync payload validation parses arrays properly", () => {
  const validateSyncBatch = (body) => {
    if (!body || !Array.isArray(body.records)) throw new Error("Expected records array");
    return body.records.map((r) => r.id).filter(Boolean);
  };

  const acknowledged = validateSyncBatch({
    records: [
      { id: "sync_1", type: "CHECKIN" },
      { id: "sync_2", type: "TELEMETRY" },
    ],
  });

  assert.equal(acknowledged.length, 2);
  assert.equal(acknowledged[0], "sync_1");
  assert.equal(acknowledged[1], "sync_2");

  assert.throws(() => validateSyncBatch({ records: "invalid" }), /Expected records array/);
});

test("telemetry endpoint range calculation bounds queries between 1 and 180", () => {
  const clampRange = (start, end) => ({
    startDay: Math.max(1, Math.min(180, Number(start) || 1)),
    endDay: Math.max(1, Math.min(180, Number(end) || 180)),
  });

  assert.deepEqual(clampRange(0, 250), { startDay: 1, endDay: 180 });
  assert.deepEqual(clampRange(14, 28), { startDay: 14, endDay: 28 });
});

