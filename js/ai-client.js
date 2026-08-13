export function getAiApiUrl() {
  if (typeof window !== "undefined") {
    return String(window.DIVE_BOARD_AI_API_URL || window.VITE_AI_API_URL || "").trim();
  }
  return String(process.env.VITE_AI_API_URL || process.env.AI_API_URL || "").trim();
}

export function slimBoardContext(data) {
  return {
    date: data.date,
    overview: (data.overview || []).map(item => ({
      id: item.id,
      time: item.time,
      status: item.status,
      site: item.site
    })),
    dmRoster: (data.dmRoster || []).map(item => ({ id: item.id, name: item.name })),
    sessions: Object.fromEntries(Object.entries(data.sessions || {}).map(([id, session]) => [
      id,
      {
        displayTime: session.displayTime,
        sourceTime: session.sourceTime,
        status: session.status,
        groups: (session.groups || []).map((group, groupIndex) => ({
          groupIndex,
          dm: group.dm,
          dmId: group.dmId || "",
          context: group.context,
          divers: (group.divers || []).map(diver => ({
            name: diver.name,
            note: diver.note || "",
            certification: diver.certification,
            maxDepthM: diver.maxDepthM,
            experience: diver.experience
          }))
        }))
      }
    ]))
  };
}

export async function requestAiPlan(instruction, data, { fetchImpl = fetch, url = getAiApiUrl() } = {}) {
  if (!url) {
    return { configured: false, error: "AI natural-language service is not configured." };
  }
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction: String(instruction || "").slice(0, 2000),
      board: slimBoardContext(data)
    })
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {
    return { configured: true, error: "The AI service returned invalid JSON." };
  }
  if (!response.ok) {
    return { configured: true, error: body?.error || `AI service failed (${response.status}).` };
  }
  return { configured: true, value: body };
}
