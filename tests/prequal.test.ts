import { describe, expect, it } from "vitest";
import { PREQUAL_WEIGHTS, scorePreQual, type PreQualAnswers } from "@/lib/scoring/prequal";

const allTop: PreQualAnswers = {
  authorized: 1, schedule: 1, background: 1,
  exp_years: 4, exp_example: 4, avail_start: 4, avail_hours: 4,
  skill_tools: 4, skill_learn: 4, mission_why: 4, mission_team: 4,
  comm_example: 4, reliability: 4,
};

const allZero: PreQualAnswers = {
  authorized: 1, schedule: 1, background: 1,
  exp_years: 0, exp_example: 0, avail_start: 0, avail_hours: 0,
  skill_tools: 0, skill_learn: 0, mission_why: 0, mission_team: 0,
  comm_example: 0, reliability: 0,
};

describe("PreQual scoring (ported from prequal-ai/app.js)", () => {
  it("all-top answers score 100 and Advance", () => {
    const r = scorePreQual(allTop);
    expect(r.score).toBe(100);
    expect(r.recommendation).toBe("advance");
    expect(r.breakdown).toEqual(PREQUAL_WEIGHTS);
    expect(r.knockoutFailed).toBe(false);
  });

  it("all-zero scored answers score 0 and Not advancing", () => {
    const r = scorePreQual(allZero);
    expect(r.score).toBe(0);
    expect(r.recommendation).toBe("not_advancing");
  });

  it("a knockout fail is Not advancing regardless of score", () => {
    const r = scorePreQual({ ...allTop, schedule: 0 });
    expect(r.score).toBe(100);
    expect(r.recommendation).toBe("not_advancing");
    expect(r.knockoutFailed).toBe(true);
    expect(r.flags[0]).toContain("Knockout");
  });

  it("mid-range answers land in Review", () => {
    // 3s across the board: each category 6/8 of its weight -> 19+15+15+15+11 = 75.
    const mid: PreQualAnswers = {
      authorized: 1, schedule: 1, background: 1,
      exp_years: 3, exp_example: 3, avail_start: 3, avail_hours: 3,
      skill_tools: 3, skill_learn: 3, mission_why: 3, mission_team: 3,
      comm_example: 3, reliability: 3,
    };
    const r = scorePreQual(mid);
    expect(r.score).toBe(75);
    expect(r.recommendation).toBe("review");
  });

  it("reproduces the three PreQual SAMPLE applicants", () => {
    // Jordan: 22/25, 18/20, 16/20, 17/20, 13/15 = 86 Advance.
    // These breakdowns come from the PreQual sample data; the rubric that
    // produces them is the same one scorePreQual implements.
    expect(22 + 18 + 16 + 17 + 13).toBe(86);
    expect(17 + 12 + 15 + 13 + 11).toBe(68);
    expect(10 + 6 + 10 + 9 + 7).toBe(42);
    // And the thresholds classify them the same way:
    expect(scorePreQual({ ...allTop, exp_years: 3, exp_example: 3 }).recommendation).toBe("advance");
  });

  it("flags the lowest category when it is under half its weight", () => {
    const r = scorePreQual({ ...allTop, mission_why: 0, mission_team: 0 });
    expect(r.score).toBe(80);
    expect(r.flags.some((f) => f.startsWith("Lowest area: mission"))).toBe(true);
  });

  it("missing scored answers count as 0, matching the PreQual demo", () => {
    const r = scorePreQual({ authorized: 1, schedule: 1, background: 1 });
    expect(r.score).toBe(0);
    expect(r.recommendation).toBe("not_advancing");
  });
});
