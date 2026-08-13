import { handleAiRequest } from "../api/ai.mjs";

export default {
  async fetch(request, env) {
    return handleAiRequest(request, {
      env,
      ip: request.headers.get("cf-connecting-ip") || "unknown"
    });
  }
};
