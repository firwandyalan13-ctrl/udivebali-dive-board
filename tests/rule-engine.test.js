import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectBoard } from "../js/rule-engine.js";
import { sampleBoard } from "./fixtures.js";
import { cloneBoard, migrateBoardData } from "../js/board-model.js";

test("1:3 boundary: 3 divers with a DM is allowed", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[0].divers = [
    { name: "A" }, { name: "B" }, { name: "C" }
  ];
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "RATIO_EXCEEDED"), false);
});

test("1:3 boundary: 4 divers with a DM is blocked", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[0].divers = [
    { name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }
  ];
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "RATIO_EXCEEDED"), true);
});

test("flags a group that has divers but no DM", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-1400"].groups[0].divers[0].name = "Sari";
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "MISSING_DM"), true);
});

test("flags duplicate divers in the same session", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[1].dm = "Nyoman";
  data.sessions["slot-0900"].groups[1].divers[0].name = "Budi";
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "TIME_CONFLICT"), true);
});

test("flags duplicate names inside one group", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[0].divers = [
    { name: "Budi" }, { name: "Budi" }, { name: "-" }
  ];
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "DUPLICATE_MEMBER"), true);
});

test("flags the same DM in two groups at the same time", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[1].dm = "Alan";
  data.sessions["slot-0900"].groups[1].dmId = "dm-alan";
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "TIME_CONFLICT"), true);
});

test("blank placeholder names do not crash inspection", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[0].divers[1] = { name: "" };
  data.sessions["slot-0900"].groups[0].divers[2] = { name: "   " };
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "INVALID_BOARD"), false);
});

test("flags invalid display time", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].displayTime = "25:99";
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "INVALID_TIME"), true);
});

test("optional depth fields warn without breaking old data", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-1400"].groups[0].dm = "Alan";
  data.sessions["slot-1400"].groups[0].divers[0] = { name: "Sari", maxDepthM: 12 };
  const result = inspectBoard(data);
  assert.equal(result.errors.some(item => item.code === "SITE_DEPTH"), false);
  assert.equal(result.warnings.some(item => item.code === "SITE_DEPTH"), true);
});

test("migration keeps old names and adds optional fields", () => {
  const old = {
    sessions: {
      "slot-0900": {
        displayTime: "09:00",
        groups: [{ dm: "Alan", divers: [{ name: "Budi", note: "OW" }] }]
      }
    }
  };
  const migrated = migrateBoardData(old);
  assert.equal(migrated.sessions["slot-0900"].groups[0].divers[0].name, "Budi");
  assert.equal(migrated.sessions["slot-0900"].groups[0].dmId, "");
  assert.equal("certification" in migrated.sessions["slot-0900"].groups[0].divers[0], true);
});
