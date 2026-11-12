import { db } from "./client";
import type { Prisma } from "../../generated/prisma/client";

export const latestForCandidate = (candidateId: string) =>
  db().interview.findFirst({ where: { candidateId }, orderBy: { createdAt: "desc" } });

export const findById = (id: string) => db().interview.findUnique({ where: { id }, include: { candidate: true } });

export const createDraft = (candidateId: string, consentTextVersion: string) =>
  db().interview.create({ data: { candidateId, consentAt: new Date(), consentTextVersion } });

export const saveAnswers = (id: string, answersEnc: string) =>
  db().interview.update({ where: { id }, data: { answersEnc } });

export const submit = (id: string) =>
  db().interview.update({ where: { id }, data: { status: "submitted", submittedAt: new Date(), retakeAllowed: false } });

export const saveEvaluation = (id: string, evaluationJson: Prisma.InputJsonValue, score: number) =>
  db().interview.update({ where: { id }, data: { status: "evaluated", evaluationJson, score } });

export const setRecruiterNotes = (id: string, recruiterNotes: string | null) =>
  db().interview.update({ where: { id }, data: { recruiterNotes } });

export const setShare = (id: string, churchIds: string[]) =>
  db().interview.update({ where: { id }, data: { shareWithChurchIds: churchIds } });

export const allowRetake = (id: string) => db().interview.update({ where: { id }, data: { retakeAllowed: true } });

export const sharedWithChurch = (churchId: string) =>
  db().interview.findMany({
    where: { shareWithChurchIds: { has: churchId }, status: "evaluated" },
    include: { candidate: true },
    orderBy: { submittedAt: "desc" },
  });
