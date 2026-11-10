import { db } from "./client";
import type { ThreadStatus } from "../../generated/prisma/client";

export const findById = (id: string) =>
  db().thread.findUnique({ where: { id }, include: { candidate: true, church: true } });

export const findPair = (candidateId: string, churchId: string) =>
  db().thread.findUnique({ where: { candidateId_churchId: { candidateId, churchId } } });

export const create = (candidateId: string, churchId: string, initiatedByUserId: string, firstMessage: string) =>
  db().thread.create({
    data: {
      candidateId,
      churchId,
      initiatedByUserId,
      messages: { create: { senderUserId: initiatedByUserId, body: firstMessage } },
    },
  });

export const setStatus = (id: string, status: ThreadStatus) =>
  db().thread.update({
    where: { id },
    data: { status, contactSharedAt: status === "accepted" ? new Date() : undefined },
  });

export const forCandidate = (candidateId: string) =>
  db().thread.findMany({ where: { candidateId }, orderBy: { updatedAt: "desc" }, include: { candidate: true, church: true } });

export const forChurch = (churchId: string) =>
  db().thread.findMany({ where: { churchId }, orderBy: { updatedAt: "desc" }, include: { candidate: true, church: true } });
