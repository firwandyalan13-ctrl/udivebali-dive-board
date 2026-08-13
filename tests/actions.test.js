import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAssistantResponse } from "../js/action-schema.js";
import { validateActionAgainstBoard } from "../js/action-validator.js";
import { previewActions, applyPreview } from "../js/action-executor.js";
import { sampleBoard } from "./fixtures.js";
import { cloneBoard } from "../js/board-model.js";

test("rejects unknown actions", () => {
  const parsed = validateAssistantResponse({
    message: "nope",
    actions: [{ type: "DELETE_BOARD", payload: {} }]
  });
  assert.equal(parsed.ok, false);
});

test("rejects invalid payload", () => {
  const error = validateActionAgainstBoard(sampleBoard(), {
    type: "ADD_DIVER",
    payload: { sessionId: "slot-0900" }
  });
  assert.match(error, /missing "name"|missing "groupIndex"/i);
});

test("rejects missing session ids", () => {
  const error = validateActionAgainstBoard(sampleBoard(), {
    type: "ADD_DIVER",
    payload: { sessionId: "slot-9999", groupIndex: 0, name: "Sari" }
  });
  assert.match(error, /does not exist/);
});

test("rejects a diver who is not in the source group", () => {
  const error = validateActionAgainstBoard(sampleBoard(), {
    type: "MOVE_DIVER",
    payload: {
      name: "Nobody",
      fromSessionId: "slot-0900",
      fromGroupIndex: 0,
      toSessionId: "slot-1100",
      toGroupIndex: 0
    }
  });
  assert.match(error, /was not found/);
});

test("preview apply updates a clone only after applyPreview", () => {
  const original = sampleBoard();
  const snapshot = cloneBoard(original);
  const preview = previewActions(original, [{
    type: "ADD_DIVER",
    payload: { sessionId: "slot-0900", groupIndex: 0, name: "Sari" }
  }]);
  assert.equal(preview.ok, true);
  assert.equal(original.sessions["slot-0900"].groups[0].divers.some(diver => diver.name === "Sari"), false);
  const applied = applyPreview(original, preview);
  assert.equal(applied.sessions["slot-0900"].groups[0].divers.some(diver => diver.name === "Sari"), true);
  assert.deepEqual(original.sessions["slot-0900"].groups[0].divers, snapshot.sessions["slot-0900"].groups[0].divers);
});

test("canceling preview leaves data unchanged", () => {
  const original = sampleBoard();
  previewActions(original, [{
    type: "ASSIGN_DM",
    payload: { sessionId: "slot-1400", groupIndex: 0, dmName: "Alan" }
  }]);
  assert.equal(original.sessions["slot-1400"].groups[0].dm, "unassigned");
});

test("preview blocks a 4th diver after the 1:3 limit", () => {
  const data = cloneBoard(sampleBoard());
  data.sessions["slot-0900"].groups[0].divers = [
    { name: "A", note: "-" },
    { name: "B", note: "-" },
    { name: "C", note: "-" },
    { name: "-", note: "-" }
  ];
  const preview = previewActions(data, [{
    type: "ADD_DIVER",
    payload: { sessionId: "slot-0900", groupIndex: 0, name: "D" }
  }]);
  assert.equal(preview.ok, false);
  assert.equal(data.sessions["slot-0900"].groups[0].divers.some(diver => diver.name === "D"), false);
});

test("blocks applying an invalid preview", () => {
  assert.throws(() => applyPreview(sampleBoard(), { ok: false, nextData: sampleBoard() }));
});

test("move Budi from 09:00 to 11:00 updates the clone", () => {
  const preview = previewActions(sampleBoard(), [{
    type: "MOVE_DIVER",
    payload: {
      name: "Budi",
      fromSessionId: "slot-0900",
      fromGroupIndex: 0,
      toSessionId: "slot-1100",
      toGroupIndex: 0
    }
  }]);
  assert.equal(preview.ok, true);
  assert.equal(preview.nextData.sessions["slot-0900"].groups[0].divers[0].name, "-");
  assert.equal(preview.nextData.sessions["slot-1100"].groups[0].divers[0].name, "Budi");
});
