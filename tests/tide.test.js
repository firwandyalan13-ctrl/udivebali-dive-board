import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addIsoDays,
  buildDaySummary,
  findExtrema,
  formatMeters,
  interpolateHeight,
  slotStamp,
  sparklinePath,
  tideApiUrl,
  trendAt
} from "../js/tide-model.js";

function seriesFrom(pairs) {
  return {
    times: pairs.map(item => item[0]),
    values: pairs.map(item => item[1])
  };
}

test("finds high and low tide turning points", () => {
  const series = seriesFrom([
    ["2026-08-13T00:00", 0.8],
    ["2026-08-13T04:00", 0.2],
    ["2026-08-13T10:00", 1.3],
    ["2026-08-13T17:30", -0.4],
    ["2026-08-13T23:00", 0.7]
  ]);
  const extrema = findExtrema(series.times, series.values, 0.08);
  assert.deepEqual(extrema.map(item => `${item.type} ${item.hm}`), [
    "LOW 04:00",
    "HIGH 10:00",
    "LOW 17:30"
  ]);
});

test("interpolates a height between samples", () => {
  const times = ["2026-08-13T09:00", "2026-08-13T10:00"];
  const values = [1, 2];
  const mid = interpolateHeight(times, values, "2026-08-13T09:30");
  assert.equal(Number(mid.toFixed(2)), 1.5);
});

test("detects rising vs falling trend", () => {
  const risingTimes = ["2026-08-13T08:00", "2026-08-13T09:00", "2026-08-13T10:00"];
  const risingValues = [0.2, 0.6, 1.1];
  assert.equal(trendAt(risingTimes, risingValues, "2026-08-13T10:00"), "RISING");
  const fallingTimes = ["2026-08-13T08:00", "2026-08-13T09:00", "2026-08-13T10:00"];
  const fallingValues = [1.1, 0.6, 0.2];
  assert.equal(trendAt(fallingTimes, fallingValues, "2026-08-13T10:00"), "FALLING");
});

test("slot stamps stay on the board date", () => {
  assert.equal(slotStamp("2026-08-13", "09:00"), "2026-08-13T09:00");
});

test("day summary keeps extrema on the selected date", () => {
  const series = seriesFrom([
    ["2026-08-12T23:00", 0.9],
    ["2026-08-13T04:00", 0.2],
    ["2026-08-13T10:00", 1.3],
    ["2026-08-13T17:30", -0.4],
    ["2026-08-13T23:00", 0.7],
    ["2026-08-14T04:00", 0.1]
  ]);
  const summary = buildDaySummary(series, "2026-08-13", [
    { id: "slot-0900", time: "09:00" },
    { id: "slot-1400", time: "14:00" }
  ], new Date("2026-08-12T00:00:00+08:00"));
  assert.equal(summary.isToday, false);
  assert.ok(summary.extrema.some(item => item.type === "HIGH" && item.hm === "10:00"));
  assert.ok(summary.extrema.some(item => item.type === "LOW" && item.hm === "17:30"));
  assert.equal(summary.slotReadings[0].id, "slot-0900");
  assert.ok(Number.isFinite(summary.slotReadings[0].height));
});

test("formats meters and sparkline path", () => {
  assert.equal(formatMeters(1.3), "1.30m");
  assert.match(sparklinePath([0, 1, 0.5]), /^M/);
  assert.equal(addIsoDays("2026-08-13", -1), "2026-08-12");
  assert.match(tideApiUrl("2026-08-13"), /start_date=2026-08-12/);
});
