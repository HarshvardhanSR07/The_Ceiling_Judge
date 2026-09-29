/**
 * @file services/rag.ts
 * @description Thin client for the optional Python RAG microservice.
 *
 * Not currently called from any route in this codebase — it's an
 * integration point for an "AI summary" feature that isn't wired up on
 * the backend yet (see `rag-service/` for the Python side). Fails soft:
 * any network error or non-2xx response returns a placeholder string
 * rather than throwing, so a summary request never turns into a 500 for
 * something purely cosmetic.
 */

import { config } from "../config/index.js";

export async function summarizeProject(text: string): Promise<string> {
  try {
    const res = await fetch(`${config.ragUrl}/internal/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return "Summary unavailable (RAG service offline).";
    const data = (await res.json()) as { summary?: string };
    return data.summary || "No summary.";
  } catch {
    return "Summary unavailable (RAG service offline).";
  }
}
