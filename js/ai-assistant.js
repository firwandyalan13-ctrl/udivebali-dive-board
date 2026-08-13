import { planFromInstruction, applyPlan } from "./ai-orchestrator.js";
import { getAiApiUrl } from "./ai-client.js";

const DISCLAIMER = "AI suggestions do not replace the Dive Manager’s safety judgment.";

function $(id) {
  return document.getElementById(id);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.hidden = hidden;
}

export function initAiAssistant() {
  const boardApi = window.DiveBoard;
  if (!boardApi) return;

  const drawer = $("ai-assistant-drawer");
  const overlay = $("ai-assistant-overlay");
  const openButton = $("ai-assistant-toggle");
  const closeButton = $("ai-assistant-close");
  const cancelButton = $("ai-assistant-cancel");
  const clearButton = $("ai-assistant-clear");
  const sendButton = $("ai-assistant-send");
  const applyButton = $("ai-assistant-apply");
  const input = $("ai-assistant-input");
  const status = $("ai-assistant-status");
  const result = $("ai-assistant-result");
  const notice = $("ai-assistant-notice");
  if (!drawer || !openButton || !input) return;

  let pending = null;

  function setStatus(message, kind = "") {
    status.textContent = message || "";
    status.dataset.kind = kind;
  }

  function renderResult(payload) {
    if (!payload) {
      result.innerHTML = "";
      applyButton.disabled = true;
      return;
    }
    const warnings = [
      ...(payload.plan?.warnings || []),
      ...(payload.preview?.warnings || [])
    ];
    const errors = payload.preview?.errors || [];
    const actions = payload.plan?.actions || [];
    result.innerHTML = `
      <p class="ai-message">${escape(payload.summary || payload.plan?.message || "")}</p>
      ${actions.length ? `<ul class="ai-actions">${actions.map(action => `<li><strong>${escape(action.type)}</strong> ${escape(JSON.stringify(action.payload))}</li>`).join("")}</ul>` : ""}
      ${warnings.length ? `<ul class="ai-warnings">${warnings.map(item => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}
      ${errors.length ? `<ul class="ai-errors">${errors.map(item => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}
    `;
    applyButton.disabled = Boolean(payload.inspectOnly) || !payload.preview?.ok;
  }

  function escape(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function openDrawer() {
    overlay.hidden = false;
    drawer.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    notice.textContent = getAiApiUrl()
      ? DISCLAIMER
      : `${DISCLAIMER} AI natural-language service is not configured. Local commands still work.`;
    input.focus();
  }

  function closeDrawer() {
    overlay.hidden = true;
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    pending = null;
    applyButton.disabled = true;
  }

  function clearAll() {
    input.value = "";
    pending = null;
    renderResult(null);
    setStatus("");
  }

  async function send() {
    const instruction = input.value.trim();
    if (!instruction) {
      setStatus("Enter a command first.", "error");
      return;
    }
    sendButton.disabled = true;
    applyButton.disabled = true;
    drawer.classList.add("is-loading");
    setStatus("Thinking…", "loading");
    try {
      const planned = await planFromInstruction(instruction, boardApi.getData());
      if (!planned.ok && !planned.preview) {
        pending = null;
        renderResult(null);
        setStatus(planned.error || unknownFallback(), "error");
        return;
      }
      pending = planned;
      renderResult(planned);
      if (planned.notice && !getAiApiUrl()) setStatus(planned.notice, "notice");
      else if (!planned.preview?.ok) setStatus(planned.summary, "error");
      else setStatus(planned.inspectOnly ? "Review complete. Nothing to apply." : "Preview ready. Press Apply to update the board.", "ok");
    } catch (error) {
      pending = null;
      renderResult(null);
      setStatus("The assistant could not complete that request.", "error");
    } finally {
      sendButton.disabled = false;
      drawer.classList.remove("is-loading");
    }
  }

  function unknownFallback() {
    return "I could not understand that command.";
  }

  function apply() {
    if (!pending?.preview?.ok || pending.inspectOnly) return;
    try {
      const snapshot = boardApi.getData();
      applyPlan(() => snapshot, next => boardApi.applyBoardData(next), pending);
      setStatus("Board updated.", "ok");
      pending = null;
      applyButton.disabled = true;
    } catch (error) {
      setStatus(error.message || "Could not apply those changes.", "error");
    }
  }

  openButton.addEventListener("click", openDrawer);
  closeButton.addEventListener("click", closeDrawer);
  cancelButton.addEventListener("click", () => {
    pending = null;
    renderResult(null);
    closeDrawer();
  });
  clearButton.addEventListener("click", clearAll);
  sendButton.addEventListener("click", send);
  applyButton.addEventListener("click", apply);
  overlay.addEventListener("click", closeDrawer);
  input.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      send();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !drawer.hidden) {
      event.preventDefault();
      closeDrawer();
    }
  });
  applyButton.disabled = true;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAiAssistant);
  } else {
    initAiAssistant();
  }
}
