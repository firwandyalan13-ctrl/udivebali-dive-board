import {
  cloneBoard,
  emptyGroup,
  findDiverIndex,
  findDm,
  firstEmptyGroupIndex,
  firstOpenDiverIndex,
  migrateGroupActivity,
  syncDerivedCounts
} from "./board-model.js";
import { validateActionsAgainstBoard } from "./action-validator.js";
import { inspectBoard } from "./rule-engine.js";

function requireOpenSlot(group, name) {
  const open = firstOpenDiverIndex(group);
  if (open < 0) throw new Error(`No open diver slot for "${name}".`);
  return open;
}

function applyOne(data, action) {
  const { type, payload } = action;
  if (type === "CHECK_SCHEDULE") return;

  if (type === "ASSIGN_DM") {
    const group = data.sessions[payload.sessionId].groups[payload.groupIndex];
    const dm = findDm(data, payload);
    group.dmId = dm.id;
    group.dm = dm.name;
    return;
  }

  if (type === "ADD_DIVER") {
    const group = data.sessions[payload.sessionId].groups[payload.groupIndex];
    const index = requireOpenSlot(group, payload.name);
    group.divers[index] = { name: payload.name, note: payload.note || "-" };
    return;
  }

  if (type === "REMOVE_DIVER") {
    const group = data.sessions[payload.sessionId].groups[payload.groupIndex];
    const index = findDiverIndex(group, payload.name);
    group.divers[index] = { name: "-", note: "-" };
    return;
  }

  if (type === "MOVE_DIVER") {
    const from = data.sessions[payload.fromSessionId].groups[payload.fromGroupIndex];
    const to = data.sessions[payload.toSessionId].groups[payload.toGroupIndex];
    const fromIndex = findDiverIndex(from, payload.name);
    const diver = { ...from.divers[fromIndex] };
    from.divers[fromIndex] = { name: "-", note: "-" };
    const toIndex = requireOpenSlot(to, payload.name);
    to.divers[toIndex] = diver;
    return;
  }

  if (type === "CREATE_GROUP") {
    const session = data.sessions[payload.sessionId];
    let index = firstEmptyGroupIndex(session);
    if (index < 0) {
      if (session.groups.length >= 9) throw new Error("All 9 groups are already in use.");
      session.groups.push(emptyGroup());
      index = session.groups.length - 1;
    }
    const group = session.groups[index];
    if (payload.context) {
      group.context = payload.context;
      migrateGroupActivity(group);
    }
    if (payload.dmName || payload.dmId) {
      const dm = findDm(data, payload);
      if (dm) {
        group.dm = dm.name;
        group.dmId = dm.id;
      }
    }
    return;
  }

  if (type === "CHANGE_SITE") {
    const session = data.sessions[payload.sessionId];
    const overview = (data.overview || []).find(item => item.id === payload.sessionId);
    if (overview) overview.site = payload.site;
    if (payload.groupIndex === undefined) {
      for (const group of session.groups) {
        if (group.context && group.context !== "—") {
          group.context = group.context.replace(/^.*?(\s*[·•]\s*)/, `${payload.site}$1`);
          if (!/[·•]/.test(group.context)) group.context = payload.site;
        }
      }
    } else if (session.groups[payload.groupIndex]) {
      const group = session.groups[payload.groupIndex];
      const suffix = String(group.context || "").split(/[·•]/).slice(1).join("·").trim();
      group.context = suffix ? `${payload.site} · ${suffix}` : payload.site;
    }
  }
}

export function previewActions(data, actions) {
  const shapeErrors = validateActionsAgainstBoard(data, actions);
  if (shapeErrors.length) {
    return { ok: false, errors: shapeErrors, warnings: [], nextData: null };
  }
  const nextData = cloneBoard(data);
  try {
    for (const action of actions) applyOne(nextData, action);
  } catch (error) {
    return { ok: false, errors: [error.message], warnings: [], nextData: null };
  }
  syncDerivedCounts(nextData);
  const inspection = inspectBoard(nextData);
  const blocking = inspection.errors.map(item => item.message);
  return {
    ok: blocking.length === 0,
    errors: blocking,
    warnings: inspection.warnings.map(item => item.message),
    nextData,
    inspection
  };
}

export function applyPreview(currentData, preview) {
  if (!preview?.ok || !preview.nextData) {
    throw new Error("Cannot apply an invalid preview.");
  }
  return preview.nextData;
}
