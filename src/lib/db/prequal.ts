import { db } from "./client";
import type { PreQualResult } from "../scoring/prequal";

/** Create a PreQual assessment. Scoring is done by the caller (the API route re-scores server-side). */
export function createAssessment(data: {
  candidateId?: string | null;
  churchId?: string | null;
  applicantName: string;
  applicantEmail: string;
  role: string;
  answers: Record<string, number>;
  result: PreQualResult;
}) {
  return db().preQualAssessment.create({
    data: {
      candidateId: data.candidateId ?? null,
      churchId: data.churchId ?? null,
      applicantName: data.applicantName,
      applicantEmail: data.applicantEmail,
      role: data.role,
      answers: data.answers,
      breakdown: data.result.breakdown,
      score: data.result.score,
      recommendation: data.result.recommendation,
      knockoutFailed: data.result.knockoutFailed,
      flags: data.result.flags,
      modelVersion: data.result.modelVersion,
    },
  });
}

export const findById = (id: string) => db().preQualAssessment.findUnique({ where: { id } });

/** Assessments for one church's roles, best first. Only the owning church should call this (enforced by the route). */
export const listForChurch = (churchId: string, opts: { take?: number; skip?: number } = {}) =>
  db().preQualAssessment.findMany({
    where: { churchId },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
  });

/** A candidate's own assessments, newest first. */
export const listForCandidate = (candidateId: string, opts: { take?: number; skip?: number } = {}) =>
  db().preQualAssessment.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
  });
