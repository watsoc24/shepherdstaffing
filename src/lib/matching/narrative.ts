import { completeText } from "../ai/anthropic";
import { HttpError } from "../api/errors";
import { chat } from "../db";
import { MATCH_WEIGHTS, ruleNarrative } from "./score";

export type NarrativeInput = {
  candidate: { name: string | null; position: string | null; theology: string | null; yearsExp: number | null; currentRole: string | null; strengths: string | null; philosophy: string | null };
  church: { name: string | null; position: string | null; theology: string | null; city: string | null; size: string | null; culture: string | null };
  score: number;
  breakdown: Record<string, number>;
};

const SYSTEM =
  "You are a recruiting assistant for church hiring. Given a candidate and a church (public profile fields only), write a short, honest compatibility note. Return JSON only: {\"strengths\": [3 short strings], \"gaps\": [up to 3 short strings], \"recommendation\": \"one sentence\"}. Never invent facts not in the profiles. Never mention salaries, health, or family circumstances.";

/**
 * LLM narrative for a match, with a deterministic fallback. Public fields
 * only — private/encrypted profile notes are never sent to the model.
 * Returns the source so callers can tell the user what wrote it.
 */
export async function generateNarrative(
  input: NarrativeInput,
  userId: string | null,
): Promise<{ strengths: string[]; gaps: string[]; recommendation: string; usedAi: boolean }> {
  const fallback = ruleNarrative(input.score, input.breakdown);
  try {
    const { text, inputTokens, outputTokens, model } = await completeText({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            candidate: input.candidate,
            church: input.church,
            score: input.score,
            breakdown: input.breakdown,
            weights: MATCH_WEIGHTS,
          }),
        },
      ],
      maxTokens: 600,
    });
    await chat.recordUsage({ userId, feature: "match", model, inputTokens, outputTokens, ok: true });
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { strengths?: unknown; gaps?: unknown; recommendation?: unknown };
    const strArr = (v: unknown): string[] | null =>
      Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim()) ? (v as string[]) : null;
    const strengths = strArr(parsed.strengths);
    const gaps = strArr(parsed.gaps);
    const recommendation = typeof parsed.recommendation === "string" && parsed.recommendation.trim() ? parsed.recommendation.trim() : null;
    if (!strengths || !gaps || !recommendation) return { ...fallback, usedAi: false };
    return { strengths, gaps, recommendation, usedAi: true };
  } catch (err) {
    if (err instanceof HttpError && err.code === "AI_NOT_CONFIGURED") return { ...fallback, usedAi: false };
    await chat
      .recordUsage({ userId, feature: "match", model: "unknown", inputTokens: 0, outputTokens: 0, ok: false })
      .catch(() => undefined);
    return { ...fallback, usedAi: false };
  }
}
