import { describe, expect, it } from "vitest";
import {
  computeCandidateScore,
  computeChurchScore,
  publicCandidateView,
  publicChurchView,
  type CandidateProfile,
  type ChurchProfile,
} from "../src/lib/profiles";

const emptyCandidate = (): CandidateProfile => ({
  id: "c1", displayCode: "ABC123",
  name: null, position: null, theology: null, yearsExp: null, currentRole: null,
  geoPreference: null, relocation: null, salaryRange: null, philosophy: null,
  strengths: null, callingNotes: null, nonNegotiables: null, privateNotes: null,
  familyNotes: null, visibility: "public", verified: false, profileScore: 0,
});

const emptyChurch = (): ChurchProfile => ({
  id: "ch1", displayCode: "XYZ789",
  name: null, city: null, region: null, denomination: null, theology: null,
  size: null, stage: null, position: null, salaryRange: null, timeline: null,
  culture: null, mustHave: null, niceToHave: null, whyHere: null,
  dealBreakers: null, visibility: "public", profileScore: 0,
});

describe("computeCandidateScore (14 scored fields)", () => {
  it("empty profile scores 0", () => {
    expect(computeCandidateScore(emptyCandidate())).toBe(0);
  });

  it("full profile scores 100", () => {
    const p = emptyCandidate();
    Object.assign(p, {
      name: "Jordan", position: "Lead Pastor", theology: "Reformed", yearsExp: 8,
      currentRole: "Associate Pastor", geoPreference: "Midwest", relocation: "Yes",
      salaryRange: "$70-85k", philosophy: "Shepherd first", strengths: "Teaching, care",
      callingNotes: "Called to plant", nonNegotiables: "Sabbath", privateNotes: "Note",
      familyNotes: "Two kids",
    });
    expect(computeCandidateScore(p)).toBe(100);
  });

  it("half the fields scores 50", () => {
    const p = emptyCandidate();
    Object.assign(p, { name: "Jordan", position: "Lead Pastor", theology: "Reformed", yearsExp: 8, currentRole: "Associate", geoPreference: "Midwest", relocation: "Yes" });
    expect(computeCandidateScore(p)).toBe(50);
  });

  it("visibility and verified do not count", () => {
    const p = emptyCandidate();
    p.visibility = "hidden";
    p.verified = true;
    expect(computeCandidateScore(p)).toBe(0);
  });
});

describe("computeChurchScore (15 scored fields)", () => {
  it("empty profile scores 0", () => {
    expect(computeChurchScore(emptyChurch())).toBe(0);
  });

  it("full profile scores 100", () => {
    const p = emptyChurch();
    Object.assign(p, {
      name: "Grace Church", city: "Cincinnati", region: "Cincinnati metro", denomination: "Non-denominational",
      theology: "Evangelical", size: "~120", stage: "Growing", position: "Lead Pastor",
      salaryRange: "$70-85k", timeline: "By spring", culture: "Warm", mustHave: "Preaching",
      niceToHave: "Music", whyHere: "A family", dealBreakers: "None",
    });
    expect(computeChurchScore(p)).toBe(100);
  });

  it("5 of 15 fields scores 33", () => {
    const p = emptyChurch();
    Object.assign(p, { name: "Grace", city: "Cincinnati", region: "Cincinnati", denomination: "Baptist", theology: "Evangelical" });
    expect(computeChurchScore(p)).toBe(33);
  });
});

describe("public views strip private fields", () => {
  it("candidate public view drops all four private notes", () => {
    const p = emptyCandidate();
    Object.assign(p, { name: "Jordan", callingNotes: "secret", nonNegotiables: "secret", privateNotes: "secret", familyNotes: "secret" });
    const v = publicCandidateView(p);
    expect(v).not.toHaveProperty("callingNotes");
    expect(v).not.toHaveProperty("nonNegotiables");
    expect(v).not.toHaveProperty("privateNotes");
    expect(v).not.toHaveProperty("familyNotes");
    expect(v.name).toBe("Jordan");
  });

  it("church public view drops deal-breakers", () => {
    const p = emptyChurch();
    Object.assign(p, { name: "Grace", dealBreakers: "secret" });
    const v = publicChurchView(p);
    expect(v).not.toHaveProperty("dealBreakers");
    expect(v.name).toBe("Grace");
  });
});
