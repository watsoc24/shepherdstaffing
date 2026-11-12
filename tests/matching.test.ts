import { describe, expect, it } from "vitest";
import { inputsHash, ruleNarrative, scoreMatch, type MatchInputs } from "../src/lib/matching/score";

const base = (): MatchInputs => ({
  candidate: { position: "Lead Pastor", theology: "Reformed Baptist", yearsExp: 8, geoPreference: "Cincinnati", relocation: "Yes" },
  church: { position: "Lead Pastor", theology: "Reformed Baptist", city: "Cincinnati", region: "Ohio" },
  prequalScore: 86,
});

describe("scoreMatch", () => {
  it("a full fit scores 97 (theology 30 + position 20 + experience 15 + geography 15 + prequal 17)", () => {
    const { score, breakdown } = scoreMatch(base());
    expect(breakdown).toEqual({ theology: 30, position: 20, experience: 15, geography: 15, prequal: 17 });
    expect(score).toBe(97);
  });

  it("mismatched theology drops the theology component to 6", () => {
    const inputs = base();
    inputs.church.theology = "Pentecostal";
    const { score, breakdown } = scoreMatch(inputs);
    expect(breakdown.theology).toBe(6);
    expect(score).toBe(97 - 24);
  });

  it("no PreQual screening is neutral (10), not a punishment", () => {
    const inputs = base();
    inputs.prequalScore = null;
    const { breakdown, score } = scoreMatch(inputs);
    expect(breakdown.prequal).toBe(10);
    expect(score).toBe(90);
  });

  it("a PreQual score of 0 contributes 0", () => {
    const inputs = base();
    inputs.prequalScore = 0;
    expect(scoreMatch(inputs).breakdown.prequal).toBe(0);
  });

  it("unknown theology on either side is neutral (15)", () => {
    const inputs = base();
    inputs.candidate.theology = null;
    expect(scoreMatch(inputs).breakdown.theology).toBe(15);
  });

  it("relocation willingness rescues geography when the city does not match", () => {
    const inputs = base();
    inputs.candidate.geoPreference = "Denver";
    const { breakdown } = scoreMatch(inputs);
    expect(breakdown.geography).toBe(9);
  });

  it("experience bands: 5+ years 15, 2–4 years 11, none stated 8", () => {
    expect(scoreMatch(base()).breakdown.experience).toBe(15);
    const mid = base();
    mid.candidate.yearsExp = 3;
    expect(scoreMatch(mid).breakdown.experience).toBe(11);
    const unknown = base();
    unknown.candidate.yearsExp = null;
    expect(scoreMatch(unknown).breakdown.experience).toBe(8);
  });

  it("score never exceeds 100", () => {
    const inputs = base();
    inputs.prequalScore = 100;
    expect(scoreMatch(inputs).score).toBeLessThanOrEqual(100);
  });
});

describe("inputsHash", () => {
  it("is stable for the same inputs and changes when an input changes", () => {
    const a = inputsHash(base());
    const b = inputsHash(base());
    expect(a).toBe(b);
    const changed = base();
    changed.candidate.yearsExp = 9;
    expect(inputsHash(changed)).not.toBe(a);
  });
});

describe("ruleNarrative", () => {
  it('recommends strongly at 80+, advises caution in the middle, and calls weak fits weak', () => {
    expect(ruleNarrative(90, { theology: 30, position: 20, experience: 15, geography: 15, prequal: 17 }).recommendation).toMatch(/Strong match/);
    expect(ruleNarrative(60, { theology: 6, position: 20, experience: 11, geography: 9, prequal: 14 }).recommendation).toMatch(/closer look/);
    expect(ruleNarrative(30, { theology: 6, position: 4, experience: 4, geography: 3, prequal: 10 }).recommendation).toMatch(/Weak fit/);
  });

  it("names the strongest and weakest areas", () => {
    const n = ruleNarrative(60, { theology: 30, position: 4, experience: 15, geography: 3, prequal: 14 });
    expect(n.strengths.join(" ")).toMatch(/theology/i);
    expect(n.gaps.join(" ")).toMatch(/geography/i);
  });
});
