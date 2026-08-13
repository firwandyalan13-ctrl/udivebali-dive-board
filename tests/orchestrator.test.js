import { test } from "node:test";
import assert from "node:assert/strict";
import { planFromInstruction, applyPlan } from "../js/ai-orchestrator.js";
import { sampleBoard } from "./fixtures.js";
import { cloneBoard } from "../js/board-model.js";

test("local fallback checks the schedule without mutating data", async () => {
  const data = sampleBoard();
  const planned = await planFromInstruction("Check today's schedule", data);
  assert.equal(planned.ok, true);
  assert.equal(planned.inspectOnly, true);
  assert.equal(planned.usedAi, false);
  assert.match(planned.notice, /not configured/i);
  const before = JSON.stringify(data);
  applyPlan(() => data, next => Object.assign(data, next), planned);
  assert.equal(JSON.stringify(data), before);
});

test("unknown local commands are not guessed", async () => {
  const planned = await planFromInstruction("make it cooler somehow", sampleBoard());
  assert.equal(planned.ok, false);
  assert.equal(planned.usedAi, false);
  assert.match(planned.error, /could not understand/i);
});

test("apply after preview mutates through the provided setter only", async () => {
  const data = sampleBoard();
  const planned = await planFromInstruction("Assign Alan to the 14:00 Liberty Wreck group", data);
  assert.equal(planned.preview.ok, true);
  let stored = cloneBoard(data);
  applyPlan(() => stored, next => { stored = next; }, planned);
  assert.equal(data.sessions["slot-1400"].groups[0].dm, "unassigned");
  assert.equal(stored.sessions["slot-1400"].groups[0].dm, "Alan");
  const exported = JSON.parse(JSON.stringify(stored));
  assert.equal(exported.sessions["slot-1400"].groups[0].dm, "Alan");
  assert.equal(
    exported.overview.find(item => item.id === "slot-1400").dmGroups,
    stored.overview.find(item => item.id === "slot-1400").dmGroups
  );
});
