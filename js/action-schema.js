export const ACTION_TYPES = [
  "ASSIGN_DM",
  "ADD_DIVER",
  "MOVE_DIVER",
  "REMOVE_DIVER",
  "CREATE_GROUP",
  "CHANGE_SITE",
  "CHECK_SCHEDULE"
];

const PAYLOAD_FIELDS = {
  ASSIGN_DM: ["sessionId", "groupIndex"],
  ADD_DIVER: ["sessionId", "groupIndex", "name"],
  MOVE_DIVER: ["fromSessionId", "fromGroupIndex", "toSessionId", "toGroupIndex", "name"],
  REMOVE_DIVER: ["sessionId", "groupIndex", "name"],
  CREATE_GROUP: ["sessionId"],
  CHANGE_SITE: ["sessionId", "site"],
  CHECK_SCHEDULE: []
};

function isIndex(value) {
  return Number.isInteger(value) && value >= 0;
}

export function validateActionShape(action) {
  if (!action || typeof action !== "object") return "Action must be an object.";
  if (!ACTION_TYPES.includes(action.type)) return `Unknown action "${action.type}".`;
  const payload = action.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Action payload must be an object.";
  for (const field of PAYLOAD_FIELDS[action.type]) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      return `Action ${action.type} is missing "${field}".`;
    }
  }
  const indexFields = ["groupIndex", "fromGroupIndex", "toGroupIndex"];
  for (const field of indexFields) {
    if (payload[field] !== undefined && !isIndex(payload[field])) {
      return `Action ${action.type} has an invalid ${field}.`;
    }
  }
  if (action.type === "ASSIGN_DM" && !payload.dmId && !payload.dmName) {
    return "ASSIGN_DM needs dmId or dmName.";
  }
  return null;
}

export function validateAssistantResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "AI response must be a JSON object." };
  }
  if (typeof value.message !== "string" || !value.message.trim()) {
    return { ok: false, error: "AI response is missing a message." };
  }
  if (!Array.isArray(value.actions)) {
    return { ok: false, error: "AI response actions must be an array." };
  }
  for (const action of value.actions) {
    const shapeError = validateActionShape(action);
    if (shapeError) return { ok: false, error: shapeError };
  }
  if (value.warnings !== undefined && !Array.isArray(value.warnings)) {
    return { ok: false, error: "AI warnings must be an array." };
  }
  return {
    ok: true,
    value: {
      message: value.message.trim(),
      actions: value.actions,
      warnings: (value.warnings || []).map(item => String(item)),
      requiresConfirmation: value.requiresConfirmation !== false
    }
  };
}
