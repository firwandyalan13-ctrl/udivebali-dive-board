import {
  buildDaySummary,
  fetchTideSeries,
  formatMeters,
  isoDateInZone,
  sparklinePath
} from "./tide-model.js";

const CACHE_KEY = "tulamben-tide-v1";
const REFRESH_MS = 60 * 1000;

function boardApi() {
  return window.DiveBoard;
}

function dateIso() {
  return boardApi()?.getDateISO?.() || isoDateInZone();
}

function slots() {
  return boardApi()?.getSlots?.() || [];
}

function readCache(iso) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (parsed?.iso === iso && Array.isArray(parsed.times) && Date.now() - parsed.savedAt < 30 * 60 * 1000) {
      return parsed;
    }
  } catch {}
  return null;
}

function writeCache(iso, series) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      iso,
      times: series.times,
      values: series.values,
      savedAt: Date.now()
    }));
  } catch {}
}

function extremaText(summary) {
  if (!summary.extrema.length) return "No high/low times for this date.";
  return summary.extrema.slice(0, 4).map(item => `${item.type} ${item.hm}`).join(" · ");
}

function nowText(summary) {
  if (summary.isToday && Number.isFinite(summary.nowHeight)) {
    return `NOW ${summary.nowLabel || summary.nowTrend} ${formatMeters(summary.nowHeight)} · ${summary.clock} WITA`;
  }
  return `Tides for ${summary.boardIso}`;
}

function paintSpark(el, summary) {
  if (!el) return;
  const width = 96;
  const height = 28;
  const pad = 2;
  const path = sparklinePath(summary.dayValues, width, height, pad);
  const values = summary.dayValues;
  let nowMark = "";
  if (summary.isToday && values.length > 1 && summary.clock) {
    const minutes = Number(String(summary.clock).slice(0, 2)) * 60 + Number(String(summary.clock).slice(3, 5));
    const index = Math.min(values.length - 1, Math.max(0, Math.round(minutes / 15)));
    const min = Math.min(...values.filter(Number.isFinite));
    const max = Math.max(...values.filter(Number.isFinite));
    const span = max - min || 1;
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((values[index] - min) / span) * (height - pad * 2);
    nowMark = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="currentColor"></circle>`;
  }
  el.setAttribute("viewBox", `0 0 ${width} ${height}`);
  el.innerHTML = path
    ? `<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>${nowMark}`
    : "";
}

function paintSummary(summary) {
  const now = document.querySelector("[data-tide-now]");
  const extrema = document.querySelector("[data-tide-extrema]");
  const note = document.querySelector("[data-tide-note]");
  const spark = document.querySelector("[data-tide-spark]");
  const session = document.querySelector("[data-tide-session]");
  if (now) now.textContent = nowText(summary);
  if (extrema) extrema.textContent = extremaText(summary);
  if (note) note.textContent = "Modeled Tulamben tide · WITA · not for navigation";
  paintSpark(spark, summary);
  if (session) {
    session.textContent = summary.isToday
      ? `${summary.nowLabel || summary.nowTrend} ${formatMeters(summary.nowHeight)} · ${extremaText(summary)}`
      : extremaText(summary);
  }
  for (const slot of summary.slotReadings) {
    const target = document.querySelector(`[data-tide-slot="${slot.id}"] strong`)
      || document.querySelector(`[data-tide-slot="${slot.id}"]`);
    if (!target) continue;
    target.textContent = `${slot.label} ${formatMeters(slot.height)}`;
  }
}

function paintError(message) {
  const now = document.querySelector("[data-tide-now]");
  const extrema = document.querySelector("[data-tide-extrema]");
  const session = document.querySelector("[data-tide-session]");
  const text = message || "Tide data is unavailable.";
  if (now) now.textContent = text;
  if (extrema) extrema.textContent = "";
  if (session) session.textContent = text;
  document.querySelectorAll("[data-tide-slot] strong").forEach(node => {
    node.textContent = "—";
  });
}

let inFlight = null;
let timer = null;

export async function refreshTide() {
  const iso = dateIso();
  if (!iso) {
    paintError("Set a valid board date to load tides.");
    return;
  }
  const cached = readCache(iso);
  const series = cached ? { times: cached.times, values: cached.values } : null;
  if (series) {
    paintSummary(buildDaySummary(series, iso, slots()));
  }
  if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) return;
  const token = {};
  inFlight = token;
  try {
    const fresh = await fetchTideSeries(iso);
    if (inFlight !== token) return;
    writeCache(iso, fresh);
    paintSummary(buildDaySummary(fresh, iso, slots()));
  } catch {
    if (inFlight !== token) return;
    if (!series) paintError("Tide data is unavailable.");
  }
}

export function initTideBoard() {
  if (!boardApi()) return;
  refreshTide();
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (document.hidden) return;
    refreshTide();
  }, REFRESH_MS);
}

window.DiveTide = { refresh: refreshTide, init: initTideBoard };

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTideBoard);
  } else {
    initTideBoard();
  }
}
