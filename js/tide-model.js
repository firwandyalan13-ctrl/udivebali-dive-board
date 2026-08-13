export const TIDE_TZ = "Asia/Makassar";
export const TIDE_LAT = -8.27;
export const TIDE_LON = 115.5;
export const TIDE_API = "https://marine-api.open-meteo.com/v1/marine";
export const MIN_SWING_M = 0.08;

export function addIsoDays(iso, days) {
  const [year, month, day] = String(iso).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function isoDateInZone(date = new Date(), timeZone = TIDE_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function parseLocalStamp(stamp) {
  const value = String(stamp || "");
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  return new Date(`${value.length === 16 ? `${value}:00` : value}+08:00`);
}

export function formatHm(stamp) {
  return String(stamp).slice(11, 16);
}

export function formatMeters(value) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return `${rounded.toFixed(2)}m`;
}

export function clockInZone(date = new Date(), timeZone = TIDE_TZ) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function findExtrema(times, values, minSwing = MIN_SWING_M) {
  const points = [];
  for (let index = 0; index < times.length; index += 1) {
    const height = values[index];
    if (!Number.isFinite(height)) continue;
    points.push({ index, time: times[index], height });
  }
  const raw = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1].height;
    const height = points[index].height;
    const next = points[index + 1].height;
    if (height >= prev && height > next) {
      raw.push({ type: "HIGH", ...points[index] });
    } else if (height <= prev && height < next) {
      raw.push({ type: "LOW", ...points[index] });
    }
  }
  const extrema = [];
  for (const item of raw) {
    const previous = extrema[extrema.length - 1];
    if (previous && previous.type === item.type) {
      const replace = item.type === "HIGH" ? item.height > previous.height : item.height < previous.height;
      if (replace) extrema[extrema.length - 1] = item;
      continue;
    }
    if (previous && Math.abs(item.height - previous.height) < minSwing) continue;
    extrema.push(item);
  }
  return extrema.map(item => ({
    type: item.type,
    time: item.time,
    height: item.height,
    date: String(item.time).slice(0, 10),
    hm: formatHm(item.time),
    at: parseLocalStamp(item.time).getTime()
  }));
}

export function interpolateHeight(times, values, when) {
  const target = when instanceof Date ? when.getTime() : parseLocalStamp(when).getTime();
  if (!Number.isFinite(target) || !times.length) return null;
  const stamps = times.map(time => parseLocalStamp(time).getTime());
  if (target <= stamps[0]) return values[0];
  if (target >= stamps[stamps.length - 1]) return values[values.length - 1];
  for (let index = 1; index < stamps.length; index += 1) {
    if (target <= stamps[index]) {
      const span = stamps[index] - stamps[index - 1];
      const ratio = span ? (target - stamps[index - 1]) / span : 0;
      const left = values[index - 1];
      const right = values[index];
      if (!Number.isFinite(left) || !Number.isFinite(right)) return left ?? right ?? null;
      return left + (right - left) * ratio;
    }
  }
  return null;
}

export function trendAt(times, values, when, lookbackMs = 30 * 60 * 1000) {
  const now = interpolateHeight(times, values, when);
  const earlierWhen = new Date((when instanceof Date ? when : parseLocalStamp(when)).getTime() - lookbackMs);
  const earlier = interpolateHeight(times, values, earlierWhen);
  if (!Number.isFinite(now) || !Number.isFinite(earlier)) return "UNKNOWN";
  const delta = now - earlier;
  if (delta > 0.03) return "RISING";
  if (delta < -0.03) return "FALLING";
  return "SLACK";
}

export function labelAt(times, values, extrema, when) {
  const at = when instanceof Date ? when.getTime() : parseLocalStamp(when).getTime();
  const nearby = extrema.find(item => Math.abs(item.at - at) <= 40 * 60 * 1000);
  if (nearby) return nearby.type;
  return trendAt(times, values, when);
}

export function slotStamp(boardIso, time) {
  const hm = String(time || "").padStart(5, "0");
  return `${boardIso}T${hm}`;
}

export function buildDaySummary(series, boardIso, slots = [], now = new Date()) {
  const extrema = findExtrema(series.times, series.values).filter(item => item.date === boardIso);
  const dayTimes = [];
  const dayValues = [];
  for (let index = 0; index < series.times.length; index += 1) {
    if (String(series.times[index]).slice(0, 10) !== boardIso) continue;
    dayTimes.push(series.times[index]);
    dayValues.push(series.values[index]);
  }
  const isToday = isoDateInZone(now) === boardIso;
  const nowHeight = isToday ? interpolateHeight(series.times, series.values, now) : null;
  const nowTrend = isToday ? trendAt(series.times, series.values, now) : null;
  const slotReadings = slots.map(slot => {
    const stamp = slotStamp(boardIso, slot.time);
    const height = interpolateHeight(series.times, series.values, stamp);
    return {
      id: slot.id,
      time: slot.time,
      height,
      label: labelAt(series.times, series.values, extrema, stamp)
    };
  });
  return {
    boardIso,
    isToday,
    extrema,
    dayTimes,
    dayValues,
    nowHeight,
    nowTrend,
    nowLabel: isToday ? (labelAt(series.times, series.values, extrema, now)) : null,
    clock: isToday ? clockInZone(now) : null,
    slotReadings
  };
}

export function tideApiUrl(boardIso) {
  const start = addIsoDays(boardIso, -1);
  const end = addIsoDays(boardIso, 1);
  const params = new URLSearchParams({
    latitude: String(TIDE_LAT),
    longitude: String(TIDE_LON),
    minutely_15: "sea_level_height_msl",
    timezone: TIDE_TZ,
    start_date: start,
    end_date: end
  });
  return `${TIDE_API}?${params.toString()}`;
}

export async function fetchTideSeries(boardIso, fetchImpl = fetch) {
  const response = await fetchImpl(tideApiUrl(boardIso));
  if (!response.ok) throw new Error("Tide service is unavailable.");
  const body = await response.json();
  const times = body?.minutely_15?.time || body?.hourly?.time;
  const values = body?.minutely_15?.sea_level_height_msl || body?.hourly?.sea_level_height_msl;
  if (!Array.isArray(times) || !Array.isArray(values) || times.length !== values.length) {
    throw new Error("Tide service returned an incomplete series.");
  }
  return { times, values };
}

export function sparklinePath(values, width = 96, height = 28, pad = 2) {
  const numbers = values.filter(Number.isFinite);
  if (numbers.length < 2) return "";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || 1;
  return values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
