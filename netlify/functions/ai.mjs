import { handleAiRequest } from "../../api/ai.mjs";

export default async (req, context) => {
  return handleAiRequest(req, { ip: context.ip, origin: req.headers.get("origin") });
};

export const config = {
  path: "/api/ai",
  method: ["POST", "OPTIONS"]
};
