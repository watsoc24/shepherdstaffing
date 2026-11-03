import { db } from "./client";

export interface MatchResult {
  score: number;
  breakdown: Record<string, number>;
  strengths: string[];
  gaps: string[];
  recommendation: string;
  inputsHash: string;
  modelVersion: string;
}

export const find = (candidateId: string, churchId: string) =>
  db().match.findUnique({ where: { candidateId_churchId: { candidateId, churchId } } });

export const upsert = (candidateId: string, churchId: string, r: MatchResult) =>
  db().match.upsert({
    where: { candidateId_churchId: { candidateId, churchId } },
    create: { candidateId, churchId, ...r },
    update: { ...r },
  });

export const forCandidate = (candidateId: string) =>
  db().match.findMany({ where: { candidateId, status: { not: "dismissed" } }, orderBy: { score: "desc" }, include: { church: true } });

export const forChurch = (churchId: string) =>
  db().match.findMany({ where: { churchId, status: { not: "dismissed" } }, orderBy: { score: "desc" }, include: { candidate: true } });

export const setStatus = (id: string, status: "suggested" | "viewed" | "dismissed") =>
  db().match.update({ where: { id }, data: { status } });
