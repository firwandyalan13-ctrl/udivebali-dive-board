import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../js/command-parser.js";
import { sampleBoard } from "./fixtures.js";

test("parses English schedule check", () => {
  const result = parseCommand("Check today's schedule", sampleBoard());
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].type, "CHECK_SCHEDULE");
});

test("parses Chinese DM ratio check", () => {
  const result = parseCommand("幫我檢查今天的 DM 比例", sampleBoard());
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].type, "CHECK_SCHEDULE");
});

test("parses assign DM when the name is on the roster", () => {
  const result = parseCommand("Assign Alan to the 14:00 Liberty Wreck group", sampleBoard());
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].type, "ASSIGN_DM");
  assert.equal(result.value.actions[0].payload.sessionId, "slot-1400");
});

test("parses move command", () => {
  const result = parseCommand("Move Budi from 09:00 to 11:00", sampleBoard());
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].type, "MOVE_DIVER");
  assert.equal(result.value.actions[0].payload.fromSessionId, "slot-0900");
  assert.equal(result.value.actions[0].payload.toSessionId, "slot-1100");
});

test("parses Chinese move command", () => {
  const result = parseCommand("把 Budi 從 09:00 移到 11:00", sampleBoard());
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].type, "MOVE_DIVER");
});

test("parses change site", () => {
  const result = parseCommand("Change 14:00 site to Coral Garden", sampleBoard());
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].type, "CHANGE_SITE");
  assert.equal(result.value.actions[0].payload.site, "Coral Garden");
});

test("does not guess unknown commands", () => {
  const result = parseCommand("make it cooler somehow", sampleBoard());
  assert.equal(result.ok, false);
  assert.match(result.error, /could not understand/i);
});
