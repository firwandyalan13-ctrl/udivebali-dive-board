import { findDiverIndex, findDm, isPlaceholderName } from "./board-model.js";
import { validateActionShape } from "./action-schema.js";

function sessionOrError(data, sessionId, label = "session") {
  if (!data.sessions?.[sessionId]) return `${label} "${sessionId}" does not exist.`;
  return null;
}

function groupOrError(session, groupIndex, sessionId) {
  if (!session.groups?.[groupIndex]) return `Group ${groupIndex} does not exist in ${sessionId}.`;
  return null;
}

export function validateActionAgainstBoard(data, action) {
  const shapeError = validateActionShape(action);
  if (shapeError) return shapeError;
  const { type, payload } = action;

  if (type === "CHECK_SCHEDULE") return null;

  if (type === "ASSIGN_DM") {
    const sessionError = sessionOrError(data, payload.sessionId);
    if (sessionError) return sessionError;
    const groupError = groupOrError(data.sessions[payload.sessionId], payload.groupIndex, payload.sessionId);
    if (groupError) return groupError;
    const dm = findDm(data, payload);
    if (!dm) return `DM "${payload.dmName || payload.dmId}" was not found in the roster.`;
    return null;
  }

  if (type === "ADD_DIVER") {
    if (isPlaceholderName(payload.name)) return "Cannot add a blank diver name.";
    const sessionError = sessionOrError(data, payload.sessionId);
    if (sessionError) return sessionError;
    const group = data.sessions[payload.sessionId].groups[payload.groupIndex];
    if (!group) return `Group ${payload.groupIndex} does not exist in ${payload.sessionId}.`;
    if (findDiverIndex(group, payload.name) >= 0) return `"${payload.name}" is already in that group.`;
    return null;
  }

  if (type === "REMOVE_DIVER" || type === "MOVE_DIVER") {
    const fromId = type === "MOVE_DIVER" ? payload.fromSessionId : payload.sessionId;
    const fromIndex = type === "MOVE_DIVER" ? payload.fromGroupIndex : payload.groupIndex;
    const sessionError = sessionOrError(data, fromId, "source session");
    if (sessionError) return sessionError;
    const group = data.sessions[fromId].groups[fromIndex];
    if (!group) return `Group ${fromIndex} does not exist in ${fromId}.`;
    if (findDiverIndex(group, payload.name) < 0) return `"${payload.name}" was not found in that group.`;
    if (type === "MOVE_DIVER") {
      const destError = sessionOrError(data, payload.toSessionId, "destination session");
      if (destError) return destError;
      const dest = data.sessions[payload.toSessionId].groups[payload.toGroupIndex];
      if (!dest) return `Group ${payload.toGroupIndex} does not exist in ${payload.toSessionId}.`;
    }
    return null;
  }

  if (type === "CREATE_GROUP" || type === "CHANGE_SITE") {
    return sessionOrError(data, payload.sessionId);
  }

  return `Unknown action "${type}".`;
}

export function validateActionsAgainstBoard(data, actions) {
  const errors = [];
  for (const action of actions) {
    const error = validateActionAgainstBoard(data, action);
    if (error) errors.push(error);
  }
  return errors;
}
