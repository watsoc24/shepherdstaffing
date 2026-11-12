/**
 * M5 Matching — deterministic compatibility score, 0–100.
 *
 * The score itself is a transparent rubric, not an LLM judgement: every
 * point is traceable to a weight below, the same inputs always give the same
 * score, and it works with no API key. The LLM is used only for the
 * strengths / gaps / recommendation *text* (see narrative.ts); if it is
 * unavailable, rule-based text from the same breakdown is used instead.
 *
 * Weights: theology 30, position 20, experience 15, geography 15, PreQual 20.
 * PreQual is optional: a candidate with no screening gets a neutral 10/20
 * rather than a punishment, so new candidates are not locked out.
 */

import { sha256 } from "../security/crypto";
import type { MatchResult } from "../db/matches";

export const MATCH_MODEL_VERSION = "match-v1";

export const MATCH_WEIGHTS = {
  theology: 30,
  position: 20,
  experience: 15,
  geography: 15,
  prequal: 20,
} as const;

export type MatchInputs = {
  candidate: {
    position: string | null;
    theology: string | null;
    yearsExp: number | null;
    geoPreference: string | null;
    relocation: string | null;
  };
  church: {
    position: string | null;
    theology: string | null;
    city: string | null;
    region: string | null;
  };
  /** Best PreQual score for this candidate (0–100), or null when never screened. */
  prequalScore: number | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const tokens = (v: string | null | undefined) =>
  norm(v).split(/[^a-z0-9]+/).filter((t) => t.length > 2);

function theologyScore(c: string | null, h: string | null): number {
  const a = norm(c);
  const b = norm(h);
  if (!a || !b) return 15; // unknown on either side: neutral, not a penalty
  if (a === b) return 30;
  if (a.includes(b) || b.includes(a)) return 24;
  const shared = tokens(a).filter((t) => tokens(b).includes(t));
  if (shared.length > 0) return 18;
  return 6;
}

function positionScore(c: string | null, h: string | null): number {
  const a = norm(c);
  const b = norm(h);
  if (!a || !b) return 10;
  if (a === b) return 20;
  if (a.includes(b) || b.includes(a)) return 14;
  return 4;
}

function experienceScore(years: number | null): number {
  if (years === null || years === undefined) return 8;
  if (years >= 5) return 15;
  if (years >= 2) return 11;
  if (years >= 1) return 7;
  return 4;
}

function geographyScore(geo: string | null, relocation: string | null, city: string | null, region: string | null): number {
  const g = norm(geo);
  const place = `${norm(city)} ${norm(region)}`.trim();
  if (g && place && (place.includes(g) || g.includes(place))) return 15;
  if (g && norm(relocation).includes("yes")) return 9;
  if (!g) return 8; // no preference stated: neutral
  return 3;
}

function prequalScore(score: number | null): number {
  if (score === null || score === undefined) return 10;
  return Math.round((Math.max(0, Math.min(100, score)) / 100) * MATCH_WEIGHTS.prequal);
}

export function scoreMatch(inputs: MatchInputs): { score: number; breakdown: Record<string, number> } {
  const breakdown = {
    theology: theologyScore(inputs.candidate.theology, inputs.church.theology),
    position: positionScore(inputs.candidate.position, inputs.church.position),
    experience: experienceScore(inputs.candidate.yearsExp),
    geography: geographyScore(inputs.candidate.geoPreference, inputs.candidate.relocation, inputs.church.city, inputs.church.region),
    prequal: prequalScore(inputs.prequalScore),
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score: Math.max(0, Math.min(100, score)), breakdown };
}

/** Canonical hash of the scored inputs: recompute a match only when this changes. */
export function inputsHash(inputs: MatchInputs): string {
  return sha256(
    JSON.stringify({
      v: MATCH_MODEL_VERSION,
      c: [inputs.candidate.position, inputs.candidate.theology, inputs.candidate.yearsExp, inputs.candidate.geoPreference, inputs.candidate.relocation],
      h: [inputs.church.position, inputs.church.theology, inputs.church.city, inputs.church.region],
      p: inputs.prequalScore,
    }),
  );
}

const AREA_LABELS: Record<string, string> = {
  theology: "Theology fit",
  position: "Role fit",
  experience: "Experience",
  geography: "Geography",
  prequal: "PreQual screening",
};

/** Rule-based narrative from the breakdown. Used when the LLM is unavailable. */
export function ruleNarrative(score: number, breakdown: Record<string, number>): Pick<MatchResult, "strengths" | "gaps" | "recommendation"> {
  const entries = Object.entries(breakdown) as [keyof typeof MATCH_WEIGHTS, number][];
  const ratio = ([k, v]: [keyof typeof MATCH_WEIGHTS, number]) => v / MATCH_WEIGHTS[k];
  const sorted = [...entries].sort((a, b) => ratio(b) - ratio(a));
  const strengths = sorted
    .filter((e) => ratio(e) >= 0.6)
    .slice(0, 2)
    .map(([k]) => `Strong ${AREA_LABELS[k].toLowerCase()} (${breakdown[k]} / ${MATCH_WEIGHTS[k]})`);
  const gaps = sorted
    .filter((e) => ratio(e) < 0.5)
    .slice(-2)
    .map(([k]) => `Weaker ${AREA_LABELS[k].toLowerCase()} (${breakdown[k]} / ${MATCH_WEIGHTS[k]}) — worth exploring in conversation`);
  const recommendation =
    score >= 75
      ? "Strong match — worth contacting."
      : score >= 55
        ? "Worth a closer look — talk through the gaps before deciding."
        : "Weak fit on this pairing — the gaps outweigh the strengths.";
  return {
    strengths: strengths.length ? strengths : ["Profiles are thin — scores rest on limited information."],
    gaps: gaps.length ? gaps : ["No major gaps in the scored areas."],
    recommendation,
  };
}
