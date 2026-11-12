import { candidates, churches, matches, messages, threads, users } from "../db";
import { sendEmailSafe } from "../email/brevo";
import { forbidden, notFound } from "../api/errors";
import { canRespond, canSend, canStartThread, canView } from "./rules";

type ThreadWithSides = NonNullable<Awaited<ReturnType<typeof threads.findById>>>;

function partyOf(thread: ThreadWithSides, userId: string): "candidate" | "church" | null {
  if (thread.candidate.userId === userId) return "candidate";
  if (thread.church.userId === userId) return "church";
  return null;
}

function otherUserId(thread: ThreadWithSides, userId: string): string | null {
  const party = partyOf(thread, userId);
  if (party === "candidate") return thread.church.userId;
  if (party === "church") return thread.candidate.userId;
  return null;
}

async function notify(userId: string | null, subject: string, text: string) {
  if (!userId) return;
  const user = await users.findById(userId);
  if (!user) return;
  await sendEmailSafe({
    to: user.email,
    subject,
    text: `${text}\n\nReply in your Shepherd Staffing dashboard.`,
    html: `<p>${text}</p><p><a href="/dashboard/messages">Reply in your Shepherd Staffing dashboard</a>.</p>`,
    tag: "messaging",
  });
}

/** The signed-in user's threads, with the other side and an unread count. */
export async function listThreads(userId: string, role: "candidate" | "church") {
  const rows =
    role === "candidate"
      ? await candidates.findByUserId(userId).then((c) => (c ? threads.forCandidate(c.id) : []))
      : await churches.findByUserId(userId).then((h) => (h ? threads.forChurch(h.id) : []));
  return Promise.all(
    rows.map(async (t) => {
      const other = role === "candidate" ? t.church : t.candidate;
      return {
        id: t.id,
        status: t.status,
        contactSharedAt: t.contactSharedAt?.toISOString() ?? null,
        updatedAt: t.updatedAt.toISOString(),
        initiatedByMe: t.initiatedByUserId === userId,
        unread: await messages.unreadCount(t.id, userId),
        other: { displayCode: other.displayCode, position: other.position },
      };
    }),
  );
}

/**
 * Start (or reopen) a thread from a match. Paid members only; the match must
 * exist and not be dismissed. A declined thread reopens as requested with a
 * fresh first message; an open one is returned as-is, never duplicated.
 */
export async function startThread(input: { userId: string; canContact: boolean; matchId: string; firstMessage: string }) {
  const match = await matches.findById(input.matchId);
  if (!match) throw notFound("Match not found");
  const isCandidate = match.candidate.userId === input.userId;
  const isChurch = match.church.userId === input.userId;
  if (!isCandidate && !isChurch) throw notFound("Match not found");
  const existing = await threads.findPair(match.candidateId, match.churchId);
  const gate = canStartThread({
    canContact: input.canContact,
    hasMatch: true,
    matchDismissed: match.status === "dismissed",
    existingStatus: existing?.status ?? null,
  });
  if (!gate.ok) throw forbidden(gate.reason ?? "Not allowed.");
  if (existing && existing.status === "declined") {
    await threads.setStatus(existing.id, "requested");
    await messages.send(existing.id, input.userId, input.firstMessage);
    const full = await threads.findById(existing.id);
    if (full) await notify(otherUserId(full, input.userId), "New contact request on Shepherd Staffing", "Someone you matched with has reached out again.");
    return { threadId: existing.id, isNew: false };
  }
  const created = await threads.create(match.candidateId, match.churchId, input.userId, input.firstMessage);
  const full = await threads.findById(created.id);
  if (full) {
    await notify(
      otherUserId(full, input.userId),
      "New contact request on Shepherd Staffing",
      `A ${isCandidate ? "candidate" : "church"} you matched with has sent you a message.`,
    );
  }
  return { threadId: created.id, isNew: true };
}

/** Read a thread and its messages, marking the other side's messages read. */
export async function getThreadDetail(userId: string, threadId: string) {
  const thread = await threads.findById(threadId);
  if (!thread) throw notFound("Thread not found");
  const party = partyOf(thread, userId);
  const view = canView({ isParty: party !== null });
  if (!view.ok) throw forbidden(view.reason ?? "Not allowed.");
  const list = await messages.list(threadId);
  await messages.markRead(threadId, userId);
  return {
    id: thread.id,
    status: thread.status,
    contactSharedAt: thread.contactSharedAt?.toISOString() ?? null,
    initiatedByMe: thread.initiatedByUserId === userId,
    party,
    other: {
      displayCode: (party === "candidate" ? thread.church : thread.candidate).displayCode,
      position: (party === "candidate" ? thread.church : thread.candidate).position,
    },
    messages: list.map((m) => ({ id: m.id, senderUserId: m.senderUserId, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.senderUserId === userId })),
  };
}

/** Send a reply inside an accepted thread. */
export async function sendReply(input: { userId: string; threadId: string; body: string }) {
  const thread = await threads.findById(input.threadId);
  if (!thread) throw notFound("Thread not found");
  const party = partyOf(thread, input.userId);
  const blocked = await messages.isBlocked(thread.candidate.userId, thread.church.userId);
  const gate = canSend({ status: thread.status, isParty: party !== null, isBlocked: blocked });
  if (!gate.ok) throw forbidden(gate.reason ?? "Not allowed.");
  const msg = await messages.send(input.threadId, input.userId, input.body);
  await notify(otherUserId(thread, input.userId), "New message on Shepherd Staffing", "You have a new message in your Shepherd Staffing conversation.");
  return { id: msg.id, createdAt: msg.createdAt.toISOString() };
}

/** Accept or decline a requested thread. Only the recipient may answer. */
export async function respondToThread(input: { userId: string; threadId: string; accept: boolean }) {
  const thread = await threads.findById(input.threadId);
  if (!thread) throw notFound("Thread not found");
  const gate = canRespond({ status: thread.status, isRecipient: thread.initiatedByUserId !== input.userId && partyOf(thread, input.userId) !== null });
  if (!gate.ok) throw forbidden(gate.reason ?? "Not allowed.");
  return threads.setStatus(input.threadId, input.accept ? "accepted" : "declined");
}

/** Block the other party and close the thread. */
export async function blockThread(input: { userId: string; threadId: string }) {
  const thread = await threads.findById(input.threadId);
  if (!thread) throw notFound("Thread not found");
  const other = otherUserId(thread, input.userId);
  if (!other) throw forbidden("You are not part of this conversation.");
  await messages.block(input.userId, other);
  await threads.setStatus(input.threadId, "closed");
}

/** Report the other party (stays in the Report table for admin review, M8). */
export async function reportThread(input: { userId: string; threadId: string; reason: string }) {
  const thread = await threads.findById(input.threadId);
  if (!thread) throw notFound("Thread not found");
  const other = otherUserId(thread, input.userId);
  if (!other) throw forbidden("You are not part of this conversation.");
  await messages.report(input.userId, other, input.reason, input.threadId);
}
