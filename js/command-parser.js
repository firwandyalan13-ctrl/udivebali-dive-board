import { bestDestinationGroupIndex, findDiverLocation, findGroupIndexBySite, findSessionIdByTime } from "./board-model.js";

const EXAMPLES = [
  "Check today's schedule",
  "幫我檢查今天的 DM 比例",
  "Assign Alan to the 14:00 Liberty Wreck group",
  "把 Alan 分到 14:00 Liberty Wreck",
  "Move Budi from 09:00 to 11:00",
  "把 Budi 從 09:00 移到 11:00",
  "Change 14:00 site to Coral Garden"
];

export function unknownCommandMessage() {
  return `I could not understand that command. Try one of these:\n- ${EXAMPLES.join("\n- ")}`;
}

function timeToken(value) {
  const match = String(value).match(/\b(\d{1,2}:\d{2})\b/);
  return match ? match[1] : null;
}

export function parseCommand(text, data) {
  const input = String(text || "").trim();
  if (!input) return { ok: false, error: "Enter a command first." };

  if (/^(check|inspect|audit|review).*(schedule|board|ratio)|幫我檢查|檢查.*(行程|排班|比例|schedule)|dm 比例/i.test(input)) {
    return {
      ok: true,
      value: {
        message: "Checking today's schedule against local safety rules.",
        actions: [{ type: "CHECK_SCHEDULE", payload: {} }],
        warnings: [],
        requiresConfirmation: false
      }
    };
  }

  const move = input.match(/^(?:move|將|把)\s+(.+?)\s+(?:from|從)\s+(\d{1,2}:\d{2})\s+(?:to|移到|改到)\s+(\d{1,2}:\d{2})\s*$/i)
    || input.match(/^move\s+(.+?)\s+from\s+(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})/i);
  if (move) {
    const fromSessionId = findSessionIdByTime(data, move[2]);
    const toSessionId = findSessionIdByTime(data, move[3]);
    if (!fromSessionId || !toSessionId) return { ok: false, error: "Unknown time. Use 09:00, 11:00, 14:00, or 18:30." };
    const name = move[1].trim();
    const located = findDiverLocation(data, name);
    const fromGroupIndex = located?.sessionId === fromSessionId ? located.groupIndex : 0;
    const toGroupIndex = bestDestinationGroupIndex(data.sessions[toSessionId]);
    return {
      ok: true,
      value: {
        message: `Move ${name} from ${move[2]} to ${move[3]}.`,
        actions: [{
          type: "MOVE_DIVER",
          payload: { name, fromSessionId, fromGroupIndex, toSessionId, toGroupIndex }
        }],
        warnings: [],
        requiresConfirmation: true
      }
    };
  }

  const assign = input.match(/^(?:assign|將|把)\s+(.+?)\s+(?:to(?:\s+the)?|分到|指派到|安排到)\s+(\d{1,2}:\d{2})(?:\s+(.+?))?(?:\s+group)?\s*$/i)
    || input.match(/^assign\s+(.+?)\s+to(?:\s+the)?\s+(\d{1,2}:\d{2})(?:\s+(.+?))?(?:\s+group)?/i);
  if (assign) {
    const sessionId = findSessionIdByTime(data, assign[2]);
    if (!sessionId) return { ok: false, error: `Unknown time "${assign[2]}".` };
    const siteHint = (assign[3] || "").replace(/group$/i, "").trim();
    const groupIndex = findGroupIndexBySite(data.sessions[sessionId], siteHint);
    const name = assign[1].trim();
    const rosterHit = (data.dmRoster || []).some(item => String(item.name || "").toLowerCase() === name.toLowerCase());
    const action = rosterHit
      ? { type: "ASSIGN_DM", payload: { sessionId, groupIndex, dmName: name } }
      : { type: "ADD_DIVER", payload: { sessionId, groupIndex, name } };
    return {
      ok: true,
      value: {
        message: rosterHit ? `Assign DM ${name} to ${assign[2]}.` : `Add ${name} to ${assign[2]}.`,
        actions: [action],
        warnings: [],
        requiresConfirmation: true
      }
    };
  }

  const remove = input.match(/^(?:remove|刪除|移除)\s+(.+?)\s+(?:from|從)\s+(\d{1,2}:\d{2})/i);
  if (remove) {
    const sessionId = findSessionIdByTime(data, remove[2]);
    if (!sessionId) return { ok: false, error: `Unknown time "${remove[2]}".` };
    return {
      ok: true,
      value: {
        message: `Remove ${remove[1].trim()} from ${remove[2]}.`,
        actions: [{ type: "REMOVE_DIVER", payload: { sessionId, groupIndex: 0, name: remove[1].trim() } }],
        warnings: [],
        requiresConfirmation: true
      }
    };
  }

  const site = input.match(/^(?:change|set)\s+(\d{1,2}:\d{2})\s+site\s+(?:to\s+)?(.+)/i)
    || input.match(/(\d{1,2}:\d{2})\s*(?:潛點|site)\s*(?:改成|改為|to)\s*(.+)/i);
  if (site) {
    const sessionId = findSessionIdByTime(data, site[1]);
    if (!sessionId) return { ok: false, error: `Unknown time "${site[1]}".` };
    return {
      ok: true,
      value: {
        message: `Change ${site[1]} site to ${site[2].trim()}.`,
        actions: [{ type: "CHANGE_SITE", payload: { sessionId, site: site[2].trim() } }],
        warnings: [],
        requiresConfirmation: true
      }
    };
  }

  if (timeToken(input) && /assign|move|check|分到|移到|檢查/i.test(input) === false) {
    return { ok: false, error: unknownCommandMessage() };
  }

  return { ok: false, error: unknownCommandMessage() };
}
