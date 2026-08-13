export const SESSION_IDS = ["slot-0900", "slot-1100", "slot-1400", "slot-1830"];
export const MAX_RATIO = 3;
export const CERT_RANK = { OW: 1, AOW: 2, Rescue: 3, DM: 4 };

const PLACEHOLDER_NAMES = new Set(["", "-", "—", "open"]);
const PLACEHOLDER_DMS = new Set(["", "-", "—", "unassigned", "?"]);

export function isPlaceholderName(name) {
  return PLACEHOLDER_NAMES.has(String(name ?? "").trim().toLowerCase());
}

export function isPlaceholderDm(dm) {
  return PLACEHOLDER_DMS.has(String(dm ?? "").trim().toLowerCase());
}

export function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function namesEqual(a, b) {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

export function countGroupDivers(group) {
  return (group?.divers || []).filter(diver => !isPlaceholderName(diver?.name)).length;
}

export function capacityMax(capacity, fallback = MAX_RATIO) {
  const match = String(capacity ?? "").trim().match(/^(?:\d+|-)\s*\/\s*(\d+)$/);
  return match ? Number(match[1]) : fallback;
}

export function isValidTime(value) {
  return /^\d{1,2}:\d{2}$/.test(String(value ?? "").trim()) &&
    (() => {
      const [h, m] = String(value).trim().split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    })();
}

export function emptyDiver() {
  return { name: "-", note: "-" };
}

export function emptyGroup() {
  return {
    marker: "?",
    dm: "unassigned",
    capacity: "0/3",
    context: "—",
    divers: [emptyDiver(), emptyDiver(), emptyDiver()],
    dmId: ""
  };
}

export function migrateBoardData(data) {
  if (!data || typeof data !== "object") return data;
  if (!Array.isArray(data.dmRoster)) data.dmRoster = [];
  for (const session of Object.values(data.sessions || {})) {
    if (!isValidTime(session.displayTime) && isValidTime(session.sourceTime)) {
      session.displayTime = session.sourceTime;
    }
    for (const group of session.groups || []) {
      if (typeof group.dmId !== "string") group.dmId = "";
      if (!Array.isArray(group.divers)) group.divers = [emptyDiver(), emptyDiver(), emptyDiver()];
      for (const diver of group.divers) {
        if (diver && typeof diver === "object") {
          if (!("certification" in diver)) diver.certification = undefined;
          if (!("maxDepthM" in diver)) diver.maxDepthM = undefined;
          if (!("experience" in diver)) diver.experience = undefined;
        }
      }
    }
  }
  return data;
}

export function findSessionIdByTime(data, time) {
  const wanted = String(time ?? "").trim();
  const overviewHit = (data.overview || []).find(item => item.time === wanted);
  if (overviewHit?.id && data.sessions?.[overviewHit.id]) return overviewHit.id;
  for (const [id, session] of Object.entries(data.sessions || {})) {
    if (session.displayTime === wanted || session.sourceTime === wanted) return id;
  }
  return null;
}

export function findDm(data, { dmId, dmName } = {}) {
  const roster = data.dmRoster || [];
  if (dmId) {
    const byId = roster.find(item => item.id === dmId);
    if (byId) return byId;
  }
  if (dmName) {
    const wanted = normalizeName(dmName).toLowerCase();
    return roster.find(item => normalizeName(item.name).toLowerCase() === wanted) || null;
  }
  return null;
}

export function resolveDmName(data, group) {
  const record = findDm(data, { dmId: group?.dmId, dmName: group?.dm });
  if (record?.name) return record.name;
  const raw = normalizeName(group?.dm);
  return raw || "-";
}

export function findGroupIndexBySite(session, siteHint) {
  const hint = normalizeName(siteHint).toLowerCase();
  if (!hint) return 0;
  const groups = session?.groups || [];
  const match = groups.findIndex(group => String(group.context || "").toLowerCase().includes(hint));
  return match >= 0 ? match : 0;
}

export function firstOpenDiverIndex(group) {
  return (group?.divers || []).findIndex(diver => isPlaceholderName(diver?.name));
}

export function firstEmptyGroupIndex(session) {
  return (session?.groups || []).findIndex(group =>
    isPlaceholderDm(group.dm) && countGroupDivers(group) === 0
  );
}

export function bestDestinationGroupIndex(session) {
  const groups = session?.groups || [];
  const withDm = groups.findIndex(group => !isPlaceholderDm(group.dm) && firstOpenDiverIndex(group) >= 0);
  if (withDm >= 0) return withDm;
  const open = groups.findIndex(group => firstOpenDiverIndex(group) >= 0);
  return open >= 0 ? open : 0;
}

export function findDiverIndex(group, name) {
  return (group?.divers || []).findIndex(diver => namesEqual(diver?.name, name) && !isPlaceholderName(diver?.name));
}

export function findDiverLocation(data, name) {
  for (const [sessionId, session] of Object.entries(data.sessions || {})) {
    for (let groupIndex = 0; groupIndex < (session.groups || []).length; groupIndex += 1) {
      if (findDiverIndex(session.groups[groupIndex], name) >= 0) {
        return { sessionId, groupIndex };
      }
    }
  }
  return null;
}

export function syncDerivedCounts(data) {
  if (!data?.overview || !data?.sessions) return data;
  for (const item of data.overview) {
    const session = data.sessions[item.id];
    if (!session) continue;
    for (const group of session.groups || []) {
      group.capacity = `${countGroupDivers(group)}/${capacityMax(group.capacity)}`;
    }
    let divers = 0;
    let dmGroups = 0;
    for (const group of session.groups || []) {
      divers += countGroupDivers(group);
      if (!isPlaceholderDm(resolveDmName(data, group))) dmGroups += 1;
    }
    item.dmGroups = dmGroups;
    item.divers = divers;
    session.summary = `${dmGroups} DM · ${divers} DIVERS`;
  }
  return data;
}

export function cloneBoard(data) {
  return structuredClone(data);
}

export function siteHintFromContext(context) {
  return String(context || "");
}

export const SITE_PROFILES = [
  { match: /liberty|wreck/i, maxDepthM: 30, minCert: "OW" },
  { match: /coral garden/i, maxDepthM: 18, minCert: "OW" },
  { match: /drop\s*off|dropoff/i, maxDepthM: 30, minCert: "AOW" },
  { match: /nusa penida|penida/i, maxDepthM: 30, minCert: "AOW" }
];

export function profileForSite(text) {
  return SITE_PROFILES.find(item => item.match.test(String(text || ""))) || null;
}
