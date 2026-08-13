import { parseCommand, unknownCommandMessage } from "./command-parser.js";
import { validateAssistantResponse } from "./action-schema.js";
import { previewActions, applyPreview } from "./action-executor.js";
import { inspectBoard, formatInspection } from "./rule-engine.js";
import { getAiApiUrl, requestAiPlan } from "./ai-client.js";
import { cloneBoard } from "./board-model.js";

export async function planFromInstruction(instruction, data) {
  const url = getAiApiUrl();
  if (url) {
    try {
      const remote = await requestAiPlan(instruction, data);
      if (!remote.configured) {
        return finishLocal(instruction, data, remote.error);
      }
      if (remote.error) return { ok: false, error: remote.error, usedAi: true };
      const parsed = validateAssistantResponse(remote.value);
      if (!parsed.ok) return { ok: false, error: parsed.error, usedAi: true };
      return buildPreview(parsed.value, data, true);
    } catch (error) {
      return { ok: false, error: "Could not reach the AI service. Try a local command instead.", usedAi: true };
    }
  }
  return finishLocal(instruction, data, "AI natural-language service is not configured.");
}

function finishLocal(instruction, data, notice) {
  const parsed = parseCommand(instruction, data);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, notice, usedAi: false };
  }
  return buildPreview(parsed.value, data, false, notice);
}

function buildPreview(plan, data, usedAi, notice) {
  const preview = previewActions(data, plan.actions);
  const before = inspectBoard(data);
  const inspectOnly = plan.actions.length === 1 && plan.actions[0].type === "CHECK_SCHEDULE";
  if (inspectOnly) {
    return {
      ok: true,
      usedAi,
      notice,
      plan,
      preview: { ...preview, ok: true, nextData: cloneBoard(data), errors: [] },
      inspection: before,
      inspectOnly: true,
      summary: formatInspection(before)
    };
  }
  return {
    ok: preview.ok,
    usedAi,
    notice,
    plan,
    preview,
    inspectOnly: false,
    summary: preview.ok
      ? plan.message
      : (preview.errors[0] || "This change is blocked by local safety rules.")
  };
}

export function applyPlan(getData, setData, previewResult) {
  if (!previewResult?.preview?.ok || previewResult.inspectOnly) return getData();
  const next = applyPreview(getData(), previewResult.preview);
  setData(next);
  return next;
}
