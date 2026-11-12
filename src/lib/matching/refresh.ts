import { candidates, churches, matches, prequal } from "../db";
import { publicCandidateView, publicChurchView, decryptCandidate, decryptChurch } from "../profiles";
import { MATCH_MODEL_VERSION, inputsHash, ruleNarrative, scoreMatch, type MatchInputs } from "./score";
import { generateNarrative } from "./narrative";

/**
 * M5 Matching — refresh one side's matches against the other side's public
 * listings. Deterministic scoring runs for every pair; the LLM narrative is
 * generated only for the top 5 pairs by score, the rest get the rule-based
 * narrative — otherwise a refresh could fire a hundred model calls.
 * A pair whose inputs have not changed is skipped (inputsHash), so refreshes
 * are cheap after the first run. Capped at 50 counterparties per refresh.
 */

const MAX_COUNTERPARTIES = 50;
const LLM_NARRATIVE_TOP = 5;

async function bestPrequalScore(candidateId: string): Promise<number | null> {
  const rows = await prequal.listForCandidate(candidateId, { take: 1 });
  return rows.length ? rows[0].score : null;
}

type Pair = { candidateId: string; churchId: string; inputs: MatchInputs; score: number; breakdown: Record<string, number> };

export async function refreshForCandidate(userId: string): Promise<{ computed: number; skipped: number }> {
  const candidateRow = await candidates.findByUserId(userId);
  if (!candidateRow) return { computed: 0, skipped: 0 };
  const candidate = publicCandidateView(decryptCandidate(candidateRow));
  const pScore = await bestPrequalScore(candidateRow.id);
  const churchRows = await churches.listPublic({ take: MAX_COUNTERPARTIES });
  return refresh(userId, candidateRow.id, churchRows, candidate, pScore, "candidate");
}

export async function refreshForChurch(userId: string): Promise<{ computed: number; skipped: number }> {
  const churchRow = await churches.findByUserId(userId);
  if (!churchRow) return { computed: 0, skipped: 0 };
  const church = publicChurchView(decryptChurch(churchRow));
  const candidateRows = await candidates.listPublic({ take: MAX_COUNTERPARTIES });
  return refresh(userId, churchRow.id, candidateRows, church, null, "church");
}

async function refresh(
  userId: string,
  ownId: string,
  counterpartRows: { id: string }[],
  ownProfile: object,
  ownPrequal: number | null,
  side: "candidate" | "church",
): Promise<{ computed: number; skipped: number }> {
  // Build deterministic pairs first (cheap), then narrate the best few.
  const pairs: Pair[] = [];
  for (const row of counterpartRows) {
    let inputs: MatchInputs;
    if (side === "candidate") {
      const church = publicChurchView(decryptChurch(row as Parameters<typeof decryptChurch>[0]));
      const c = ownProfile as ReturnType<typeof publicCandidateView>;
      inputs = {
        candidate: { position: c.position, theology: c.theology, yearsExp: c.yearsExp, geoPreference: c.geoPreference, relocation: c.relocation },
        church: { position: church.position, theology: church.theology, city: church.city, region: church.region },
        prequalScore: ownPrequal,
      };
      pairs.push({ candidateId: ownId, churchId: row.id, inputs, ...scoreMatch(inputs) });
    } else {
      const candidate = publicCandidateView(decryptCandidate(row as Parameters<typeof decryptCandidate>[0]));
      const h = ownProfile as ReturnType<typeof publicChurchView>;
      const pScore = await bestPrequalScore(row.id);
      inputs = {
        candidate: { position: candidate.position, theology: candidate.theology, yearsExp: candidate.yearsExp, geoPreference: candidate.geoPreference, relocation: candidate.relocation },
        church: { position: h.position, theology: h.theology, city: h.city, region: h.region },
        prequalScore: pScore,
      };
      pairs.push({ candidateId: row.id, churchId: ownId, inputs, ...scoreMatch(inputs) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  let computed = 0;
  let skipped = 0;
  for (const [index, pair] of pairs.entries()) {
    const existing = await matches.find(pair.candidateId, pair.churchId);
    const hash = inputsHash(pair.inputs);
    if (existing && existing.inputsHash === hash) {
      skipped++;
      continue;
    }
    let narrative = ruleNarrative(pair.score, pair.breakdown);
    let usedAi = false;
    if (index < LLM_NARRATIVE_TOP && pair.score >= 55) {
      const candidateRow = await candidates.findById(pair.candidateId);
      const churchRow = await churches.findById(pair.churchId);
      if (candidateRow && churchRow) {
        const c = publicCandidateView(decryptCandidate(candidateRow));
        const h = publicChurchView(decryptChurch(churchRow));
        const n = await generateNarrative(
          {
            candidate: { name: c.name, position: c.position, theology: c.theology, yearsExp: c.yearsExp, currentRole: c.currentRole, strengths: c.strengths, philosophy: c.philosophy },
            church: { name: h.name, position: h.position, theology: h.theology, city: h.city, size: h.size, culture: h.culture },
            score: pair.score,
            breakdown: pair.breakdown,
          },
          userId,
        );
        narrative = { strengths: n.strengths, gaps: n.gaps, recommendation: n.recommendation };
        usedAi = n.usedAi;
      }
    }
    await matches.upsert(pair.candidateId, pair.churchId, {
      score: pair.score,
      breakdown: pair.breakdown,
      strengths: narrative.strengths,
      gaps: narrative.gaps,
      recommendation: narrative.recommendation,
      inputsHash: hash,
      modelVersion: usedAi ? `${MATCH_MODEL_VERSION}+ai` : MATCH_MODEL_VERSION,
    });
    computed++;
  }
  return { computed, skipped };
}
