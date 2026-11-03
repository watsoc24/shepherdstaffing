import { db } from "./client";
import type { InquiryStatus, InquiryTier } from "../../generated/prisma/client";

export interface NewInquiry {
  userId?: string | null;
  contactName: string;
  contactEmail: string;
  churchName: string;
  tier: InquiryTier;
  role?: string | null;
  timeline?: string | null;
  budget?: string | null;
  churchSize?: string | null;
  theology?: string | null;
  notes?: string | null;
}

/** Persists every field (first pass dropped name/email/church — defect #10). */
export const create = (i: NewInquiry) => db().inquiry.create({ data: i });

export const list = (filter: { status?: InquiryStatus; tier?: InquiryTier } = {}) =>
  db().inquiry.findMany({ where: filter, orderBy: { createdAt: "desc" } });

export const findById = (id: string) => db().inquiry.findUnique({ where: { id }, include: { engagements: true } });

export const update = (id: string, data: { status?: InquiryStatus; assignedTo?: string | null; internalNotes?: string | null }) =>
  db().inquiry.update({ where: { id }, data });
