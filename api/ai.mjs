const MAX_INSTRUCTION = 2000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const hits = new Map();

function getEnv(name, extras = {}) {
  if (extras.env && extras.env[name]) return extras.env[name];
  try {
    if (typeof Netlify !== "undefined" && Netlify.env?.get) {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch {}
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "null",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

function allowedOrigin(origin, extras = {}) {
  const raw = getEnv("ALLOWED_ORIGINS", extras) || "";
  const list = raw.split(",").map(item => item.trim()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(origin);
}

function rateLimited(ip) {
  const now = Date.now();
  const current = hits.get(ip) || { count: 0, start: now };
  if (now - current.start > WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    return false;
  }
  current.count += 1;
  hits.set(ip, current);
  return current.count > MAX_REQUESTS;
}

const SYSTEM_PROMPT = `You are a dive-board assistant for UDiveBali Tulamben.
Return ONLY JSON with this shape:
{"message":"short explanation","actions":[{"type":"TYPE","payload":{}}],"warnings":[],"requiresConfirmation":true}
Allowed types: ASSIGN_DM, ADD_DIVER, MOVE_DIVER, REMOVE_DIVER, CREATE_GROUP, CHANGE_SITE, CHECK_SCHEDULE.
Payloads:
ASSIGN_DM: {sessionId, groupIndex, dmId? , dmName?}
ADD_DIVER: {sessionId, groupIndex, name, note?}
MOVE_DIVER: {fromSessionId, fromGroupIndex, toSessionId, toGroupIndex, name}
REMOVE_DIVER: {sessionId, groupIndex, name}
CREATE_GROUP: {sessionId, context?, dmName?}
CHANGE_SITE: {sessionId, site, groupIndex?}
CHECK_SCHEDULE: {}
sessionId must be one of slot-0900, slot-1100, slot-1400, slot-1830.
Do not return code. Do not modify databases. If unsure, return CHECK_SCHEDULE and explain.`;

export async function handleAiRequest(request, extras = {}) {
  const origin = request.headers.get("origin") || extras.origin || "";
  if (request.method === "OPTIONS") return json(204, {}, origin);
  if (request.method !== "POST") return json(405, { error: "Use POST." }, origin);
  if (origin && !allowedOrigin(origin, extras)) return json(403, { error: "Origin is not allowed." }, origin);

  const ip = extras.ip || request.headers.get("cf-connecting-ip") || "unknown";
  if (rateLimited(ip)) return json(429, { error: "Too many requests. Try again later." }, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Request body must be JSON." }, origin);
  }

  const instruction = String(body?.instruction || "").trim();
  if (!instruction) return json(400, { error: "Missing instruction." }, origin);
  if (instruction.length > MAX_INSTRUCTION) return json(400, { error: "Instruction is too long." }, origin);

  const apiKey = getEnv("OPENAI_API_KEY", extras) || getEnv("AI_API_KEY", extras);
  if (!apiKey) return json(503, { error: "AI natural-language service is not configured." }, origin);

  const model = getEnv("OPENAI_MODEL", extras) || "gpt-4o-mini";
  const endpoint = getEnv("OPENAI_API_URL", extras) || "https://api.openai.com/v1/chat/completions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ instruction, board: body.board }) }
        ]
      })
    });
    const raw = await response.text();
    if (!response.ok) return json(502, { error: "The language model request failed." }, origin);
    const parsed = JSON.parse(raw);
    const content = parsed.choices?.[0]?.message?.content || raw;
    const plan = JSON.parse(content);
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.actions)) {
      return json(502, { error: "The language model returned an invalid plan." }, origin);
    }
    return json(200, {
      message: String(plan.message || "Suggested board changes."),
      actions: plan.actions,
      warnings: Array.isArray(plan.warnings) ? plan.warnings.map(String) : [],
      requiresConfirmation: true
    }, origin);
  } catch {
    return json(502, { error: "The language model request failed." }, origin);
  }
}

export default async function handler(request, context) {
  return handleAiRequest(request, { env: context?.env });
}
