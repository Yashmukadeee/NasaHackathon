import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ASTRONAUTS } from "../web/db.js";

test("multi-astronaut roster is defined with valid medical profiles", () => {
  assert.equal(DEFAULT_ASTRONAUTS.length, 3);
  assert.equal(DEFAULT_ASTRONAUTS[0].id, "ASTRO-1");
  assert.equal(DEFAULT_ASTRONAUTS[1].id, "ASTRO-2");
  assert.equal(DEFAULT_ASTRONAUTS[2].id, "ASTRO-3");

  DEFAULT_ASTRONAUTS.forEach((a) => {
    assert.ok(a.name && typeof a.name === "string");
    assert.ok(a.role && typeof a.role === "string");
    assert.ok(a.blood_type && typeof a.blood_type === "string");
    assert.ok(typeof a.age === "number" && a.age > 20);
  });
});

test("compound key generator produces consistent identifiers", () => {
  const getCompoundKey = (astronautId, day) => `${astronautId}_${day}`;
  assert.equal(getCompoundKey("ASTRO-1", 45), "ASTRO-1_45");
  assert.equal(getCompoundKey("ASTRO-2", 120), "ASTRO-2_120");
});
