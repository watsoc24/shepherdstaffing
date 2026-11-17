import {
  candidates,
  chat,
  churches,
  consents,
  interviews,
  matches,
  messages,
  prequal,
  subscriptions,
  threads,
  users,
} from "../db";
import { forbidden, notFound } from "../api/errors";
import { decryptCandidate, decryptChurch } from "../profiles";
import { decrypt } from "../security/crypto";
import { audit } from "../security/audit";

/**
 * M9 Compliance — the user's own data, on their terms.
 *
 * Export: everything we hold about a user, as JSON, with secrets stripped.
 * The user gets their *own* private fields decrypted (they are theirs);
 * nobody else's data is ever in the file.
 *
 * Delete: a soft delete — the account is closed, sessions revoked, and the
 * row is marked deletedAt. Personal data is purged within 30 days (see
 * docs/RETENTION.md); the audit log keeps the event, never the content.
 * An active paid subscription must be cancelled first (Billing → Manage),
 * so we never take money from an account that no longer exists.
 */

const SECRET_FIELDS = [
  "passwordHash",
  "verifyTokenHash",
  "verifyTokenExpires",
  "resetTokenHash",
  "resetTokenExpires",
  "mfaSecretEnc",
  "mfaPendingSecretEnc",
  "mfaBackupCodeHashes",
] as const;

/** Pure: a user row with every secret removed. Export and admin lists both use this shape. */
export function stripUserSecrets<T extends Record<string, unknown>>(user: T): Omit<T, (typeof SECRET_FIELDS)[number]> {
  const copy = { ...user };
  for (const f of SECRET_FIELDS) delete copy[f];
  return copy;
}

/** Pure: only accounts without an active paid subscription may be deleted outright. */
export function isDeletable(subscriptionStatus: string): boolean {
  return subscriptionStatus !== "active" && subscriptionStatus !== "past_due";
}

export async function buildExport(userId: string) {
  const user = await users.findById(userId);
  if (!user) throw notFound("User not found");
  const candidate = await candidates.findByUserId(userId);
  const church = await churches.findByUserId(userId);
  const candidateMatches = candidate ? await matches.forCandidate(candidate.id) : [];
  const churchMatches = church ? await matches.forChurch(church.id) : [];
  const candidateThreads = candidate ? await threads.forCandidate(candidate.id) : [];
  const churchThreads = church ? await threads.forChurch(church.id) : [];
  const threadRows = [...candidateThreads, ...churchThreads];
  const threadMessages = await Promise.all(threadRows.map((t) => messages.list(t.id)));
  const latestInterview = candidate ? await interviews.latestForCandidate(candidate.id) : null;
  const interviewAnswers = latestInterview?.answersEnc
    ? JSON.parse(decrypt(latestInterview.answersEnc, "interview.answers")) as Record<string, string>
    : null;

  const data = {
    exportedAt: new Date().toISOString(),
    user: stripUserSecrets(user as unknown as Record<string, unknown>),
    candidate: candidate ? decryptCandidate(candidate) : null,
    church: church ? decryptChurch(church) : null,
    prequalAssessments: candidate ? await prequal.listForCandidate(candidate.id) : [],
    matches: [...candidateMatches, ...churchMatches].map((m) => ({
      id: m.id,
      score: m.score,
      status: m.status,
      modelVersion: m.modelVersion,
    })),
    threads: threadRows.map((t, i) => ({
      id: t.id,
      status: t.status,
      messages: threadMessages[i].map((m) => ({ senderUserId: m.senderUserId, body: m.body, createdAt: m.createdAt })),
    })),
    interview: latestInterview
      ? {
          status: latestInterview.status,
          answers: interviewAnswers,
          evaluation: latestInterview.evaluationJson,
          score: latestInterview.score,
          submittedAt: latestInterview.submittedAt,
          shareWithChurchIds: latestInterview.shareWithChurchIds,
        }
      : null,
    subscription: await subscriptions.latestForUser(userId),
    consents: await Promise.all(
      (["terms", "privacy", "interview", "share_profile", "background_check"] as const).map(async (type) => {
        const c = await consents.latest(userId, type);
        return c ? { type, version: c.version, acceptedAt: c.acceptedAt } : null;
      }),
    ).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null)),
    chatHistory: await chat.recent(userId, 100),
  };
  await audit("account.export", { actorUserId: userId, targetType: "user", targetId: userId });
  return data;
}

/** Close the account: cancel nothing silently — an active subscription must be cancelled first. */
export async function requestDeletion(userId: string) {
  const user = await users.findById(userId);
  if (!user) throw notFound("User not found");
  if (!isDeletable(user.subscriptionStatus)) {
    throw forbidden("Cancel your membership first (Billing → Manage), then delete your account.");
  }
  await users.softDelete(userId);
  await audit("account.delete", { actorUserId: userId, targetType: "user", targetId: userId });
}

export async function listConsents(userId: string) {
  const rows = await Promise.all(
    (["terms", "privacy", "interview", "share_profile", "background_check"] as const).map((type) => consents.latest(userId, type)),
  );
  return rows.filter((r): r is NonNullable<typeof r> => r !== null).map((c) => ({ type: c.type, version: c.version, acceptedAt: c.acceptedAt.toISOString() }));
}
