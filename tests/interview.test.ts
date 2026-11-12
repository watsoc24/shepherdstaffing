import { describe, expect, it } from "vitest";
import { scoreEvaluation, validateAnswers, validateEvaluation } from "../src/lib/interview/questions";

const full = { calling: "a".repeat(50), doctrine: "b".repeat(50), conflict: "c".repeat(50), team: "d".repeat(50), failure: "e".repeat(50), family: "f".repeat(50) };
const allFour = { calling: 4, doctrine: 4, conflict: 4, team: 4, failure: 4, family: 4 };

describe("M7 interview scoring and validation", () => {
  it("scores six 4s as 100 and six 0s as 0", () => {
    expect(scoreEvaluation(allFour)).toBe(100);
    expect(scoreEvaluation({ calling: 0, doctrine: 0, conflict: 0, team: 0, failure: 0, family: 0 })).toBe(0);
  });

  it("scales a half score to 50", () => {
    expect(scoreEvaluation({ calling: 2, doctrine: 2, conflict: 2, team: 2, failure: 2, family: 2 })).toBe(50);
  });

  it("rounds a mixed score", () => {
    expect(scoreEvaluation({ calling: 4, doctrine: 3, conflict: 2, team: 4, failure: 1, family: 4 })).toBe(75);
  });

  it("accepts a complete, long-enough set of answers", () => {
    expect(validateAnswers(full)).toEqual([]);
  });

  it("flags a missing or too-short answer", () => {
    const missing = { ...full };
    delete (missing as Record<string, string>).calling;
    expect(validateAnswers(missing).length).toBe(1);
    expect(validateAnswers({ ...full, doctrine: "too short" }).length).toBe(1);
  });

  it("rejects an evaluation score outside 0–4 or not a whole number", () => {
    expect(validateEvaluation(allFour)).toEqual([]);
    expect(validateEvaluation({ ...allFour, calling: 5 }).length).toBe(1);
    expect(validateEvaluation({ ...allFour, calling: 2.5 }).length).toBe(1);
    expect(validateEvaluation({ calling: 4 }).length).toBe(5);
  });
});
