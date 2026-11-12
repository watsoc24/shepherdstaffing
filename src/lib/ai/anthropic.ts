import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { HttpError } from "../api/errors";

/**
 * M5 Matching + Chat — Anthropic client. No API key or model in env means
 * AI features are unavailable, and callers fall back to deterministic
 * behaviour (the match scorer) or a clear 503 (chat). Never invented in code.
 */

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!env().ANTHROPIC_API_KEY || !env().ANTHROPIC_MODEL) {
    throw new HttpError(503, "AI features are not configured yet.", "AI_NOT_CONFIGURED");
  }
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY! });
  return client;
}

export const aiModel = () => env().ANTHROPIC_MODEL!;

export type AiTextResult = { text: string; inputTokens: number; outputTokens: number; model: string };

/** Single text completion. Returns the text plus token counts for AiUsage logging. */
export async function completeText(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number }): Promise<AiTextResult> {
  const anthropic = getAnthropic();
  const model = aiModel();
  const res = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: opts.messages,
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    text,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    model,
  };
}
