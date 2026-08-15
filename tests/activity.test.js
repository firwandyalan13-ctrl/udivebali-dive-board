import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_COURSES,
  ACTIVITY_FUN,
  formatGroupHeadline,
  migrateBoardData,
  parseGroupActivity
} from "../js/board-model.js";

test("parses fundive and courses prefixes from context", () => {
  assert.deepEqual(parseGroupActivity("Fundive · Nusa Penida"), {
    activity: ACTIVITY_FUN,
    course: "",
    context: "Nusa Penida"
  });
  assert.deepEqual(parseGroupActivity("Courses · Liberty USAT"), {
    activity: ACTIVITY_COURSES,
    course: "",
    context: "Liberty USAT"
  });
  assert.deepEqual(parseGroupActivity("Courses · OW · Liberty USAT"), {
    activity: ACTIVITY_COURSES,
    course: "OW",
    context: "Liberty USAT"
  });
  assert.deepEqual(parseGroupActivity("Coral Garden · Car 3"), {
    activity: "",
    course: "",
    context: "Coral Garden · Car 3"
  });
});

test("keeps saved activity fields instead of re-parsing notes", () => {
  const parsed = parseGroupActivity("Nusa Penida", { activity: ACTIVITY_FUN, course: "OW" });
  assert.equal(parsed.activity, ACTIVITY_FUN);
  assert.equal(parsed.course, "");
  assert.equal(parsed.context, "Nusa Penida");
});

test("formats a group headline for the board", () => {
  assert.equal(formatGroupHeadline({ activity: ACTIVITY_FUN, course: "", context: "Drop Off" }), "Fundive · Drop Off");
  assert.equal(formatGroupHeadline({ activity: ACTIVITY_COURSES, course: "AOW", context: "Liberty USAT" }), "Courses · AOW · Liberty USAT");
  assert.equal(formatGroupHeadline({ activity: "", course: "", context: "—" }), "—");
});

test("migrates old board JSON onto activity fields once", () => {
  const data = {
    sessions: {
      "slot-0900": {
        groups: [{ context: "Fundive · Coral Garden" }]
      }
    }
  };
  migrateBoardData(data);
  const group = data.sessions["slot-0900"].groups[0];
  assert.equal(group.activity, ACTIVITY_FUN);
  assert.equal(group.context, "Coral Garden");
  migrateBoardData(data);
  assert.equal(group.activity, ACTIVITY_FUN);
  assert.equal(group.context, "Coral Garden");
});
