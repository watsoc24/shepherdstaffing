import { db } from "./client";
import type { EngagementStage, InquiryTier, Prisma } from "../../generated/prisma/client";

export const create = (data: { inquiryId?: string; churchId?: string | null; tier: InquiryTier; feeAgreed?: string | null }) =>
  db().engagement.create({ data });

export const findById = (id: string) => db().engagement.findUnique({ where: { id }, include: { church: true, inquiry: true } });
export const list = () => db().engagement.findMany({ orderBy: { updatedAt: "desc" }, include: { church: true } });
export const forChurch = (churchId: string) => db().engagement.findMany({ where: { churchId }, orderBy: { createdAt: "desc" } });

export const update = (
  id: string,
  data: Partial<{
    stage: EngagementStage;
    churchId: string | null;
    feeAgreed: string | null;
    shortlist: Prisma.InputJsonValue;
    referenceChecks: Prisma.InputJsonValue;
    backgroundCheckStatus: string | null;
    guaranteeEndsAt: Date | null;
    weeklyReportLog: Prisma.InputJsonValue;
  }>,
) => db().engagement.update({ where: { id }, data });

export const recordPayment = (id: string, stripeReference: string) =>
  db().engagement.update({ where: { id }, data: { stripeReference, paidAt: new Date() } });
