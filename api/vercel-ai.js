import { handleAiRequest } from "./ai.mjs";

export default async function handler(req) {
  return handleAiRequest(req);
}

export const config = {
  runtime: "edge"
};
