import { candidates, engagements, inquiries, messages, users } from "../db";
import { forbidden, notFound } from "../api/errors";
import { decryptCandidate } from "../profiles";
import { audit, listRecent as listAuditRecent } from "../security/audit";

/**
 * M8 Admin — the operations only an admin may do, each one audited.
 * Admins are the recruiters here: they verify candidates, extend trials,
 * deactivate accounts, review reports, and read private fields when a
 * decision needs them. Every one of those reads is written to the audit
 * log (admin.decrypt_read), so a private field is never read silently.
 */

export function trialExtensionDate(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isValidReportStatus(s: string): s is "open" | "reviewed" | "actioned" {
  return s === "open" || s === "reviewed" || s === "actioned";
}

export function isValidRole(s: string): s is "candidate" | "church" | "admin" {
  return s === "candidate" || s === "church" || s === "admin";
}

export const listUsers = () => users.listRecent();

export const listCandidates = () => candidates.listRecent();

export const listReports = (status?: string) => messages.listReports(status);

export const listAudit = () => listAuditRecent(100);

export async function verifyCandidate(adminUserId: string, candidateId: string, verified: boolean) {
  const c = await candidates.findById(candidateId);
  if (!c) throw notFound("Candidate not found");
  await candidates.setVerified(candidateId, verified, verified ? adminUserId : null);
  await audit("admin.verify_candidate", { actorUserId: adminUserId, targetType: "candidate", targetId: candidateId, meta: { verified } });
}

export async function extendUserTrial(adminUserId: string, userId: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw forbidden("Extension must be 1–90 days.");
  const u = await users.findById(userId);
  if (!u) throw notFound("User not found");
  const base = u.trialEndDate && u.trialEndDate > new Date() ? u.trialEndDate : new Date();
  await users.extendTrial(userId, trialExtensionDate(base, days));
  await audit("admin.trial_extended", { actorUserId: adminUserId, targetType: "user", targetId: userId, meta: { days } });
}

export async function deactivateUser(adminUserId: string, userId: string) {
  if (adminUserId === userId) throw forbidden("You cannot deactivate your own account.");
  const u = await users.findById(userId);
  if (!u) throw notFound("User not found");
  await users.deactivate(userId);
  await audit("admin.deactivate", { actorUserId: adminUserId, targetType: "user", targetId: userId });
}

export async function changeUserRole(adminUserId: string, userId: string, role: string) {
  if (!isValidRole(role)) throw forbidden("Unknown role.");
  if (adminUserId === userId) throw forbidden("You cannot change your own role.");
  const u = await users.findById(userId);
  if (!u) throw notFound("User not found");
  await users.setRole(userId, role);
  await audit("admin.role_change", { actorUserId: adminUserId, targetType: "user", targetId: userId, meta: { role } });
}

export async function resolveReport(adminUserId: string, reportId: string, status: string) {
  if (!isValidReportStatus(status)) throw forbidden("Unknown report status.");
  const rows = await messages.listReports();
  if (!rows.some((r) => r.id === reportId)) throw notFound("Report not found");
  await messages.setReportStatus(reportId, status);
  await audit("admin.report_resolved", { actorUserId: adminUserId, targetType: "report", targetId: reportId, meta: { status } });
}

/** Read a candidate's private (decrypted) fields. Audited — this is the one place an admin may see them. */
export async function readCandidatePrivate(adminUserId: string, candidateId: string) {
  const row = await candidates.findById(candidateId);
  if (!row) throw notFound("Candidate not found");
  const p = decryptCandidate(row);
  await audit("admin.decrypt_read", { actorUserId: adminUserId, targetType: "candidate", targetId: candidateId });
  return {
    id: p.id,
    displayCode: p.displayCode,
    name: p.name,
    callingNotes: p.callingNotes,
    nonNegotiables: p.nonNegotiables,
    privateNotes: p.privateNotes,
    familyNotes: p.familyNotes,
  };
}

export async function updateInquiry(
  adminUserId: string,
  inquiryId: string,
  input: { status?: "new" | "contacted" | "scoped" | "won" | "lost"; assignedTo?: string | null; internalNotes?: string | null },
) {
  const row = await inquiries.findById(inquiryId);
  if (!row) throw notFound("Inquiry not found");
  await inquiries.update(inquiryId, input);
  await audit("admin.inquiry_updated", { actorUserId: adminUserId, targetType: "inquiry", targetId: inquiryId, meta: { status: input.status ?? null } });
}

/** Turn a won inquiry into an assisted/full engagement — the paid recruiting service. */
export async function convertInquiry(adminUserId: string, inquiryId: string) {
  const row = await inquiries.findById(inquiryId);
  if (!row) throw notFound("Inquiry not found");
  if (row.status !== "won") throw forbidden("Only a won inquiry becomes an engagement.");
  const existing = await engagements.list();
  if (existing.some((e) => e.inquiryId === inquiryId)) throw forbidden("This inquiry already has an engagement.");
  const created = await engagements.create({ inquiryId, tier: row.tier });
  await audit("admin.inquiry_converted", { actorUserId: adminUserId, targetType: "inquiry", targetId: inquiryId, meta: { tier: row.tier } });
  return { engagementId: created.id };
}

export const listEngagements = () => engagements.list();
