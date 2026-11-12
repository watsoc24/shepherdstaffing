/**
 * M6 Messaging — pure permission rules for threads. No DB, no email, no
 * session: every rule is a function of the facts, so it is unit-testable.
 *
 * The shape of the product:
 * - Only paid members can contact a match (canContact). Trial members can
 *   see match scores but not start a conversation.
 * - Contact starts with a request: the initiator's first message, status
 *   "requested". The recipient accepts or declines; only after acceptance
 *   are contact details shared (contactSharedAt) and both sides free to
 *   write. While "requested", nobody writes more — the request itself is
 *   the message, and piling on before an answer would be pressure.
 * - Declined or closed threads are dead. A declined thread can be
 *   re-requested (it reopens as "requested" with a fresh first message);
 *   a closed one cannot.
 * - Either side can block the other; a block closes the thread.
 */

export type ThreadStatus = "requested" | "accepted" | "declined" | "closed";

export function canStartThread(input: {
  canContact: boolean;
  hasMatch: boolean;
  matchDismissed: boolean;
  existingStatus: ThreadStatus | null;
}): { ok: boolean; reason?: string } {
  if (!input.canContact) return { ok: false, reason: "Contacting a match requires a membership." };
  if (!input.hasMatch) return { ok: false, reason: "You can only contact someone you matched with." };
  if (input.matchDismissed) return { ok: false, reason: "That match was dismissed." };
  if (input.existingStatus === "requested" || input.existingStatus === "accepted") {
    return { ok: false, reason: "You already have a thread with this match." };
  }
  return { ok: true };
}

/** May this user write a new message in this thread right now? */
export function canSend(input: {
  status: ThreadStatus;
  isParty: boolean;
  isBlocked: boolean;
}): { ok: boolean; reason?: string } {
  if (!input.isParty) return { ok: false, reason: "You are not part of this conversation." };
  if (input.isBlocked) return { ok: false, reason: "This conversation is blocked." };
  if (input.status === "accepted") return { ok: true };
  if (input.status === "requested") {
    return { ok: false, reason: "Wait for the other side to accept your request before writing more." };
  }
  return { ok: false, reason: "This conversation is closed." };
}

/** May this user accept or decline this thread? Only the recipient, while it is requested. */
export function canRespond(input: { status: ThreadStatus; isRecipient: boolean }): { ok: boolean; reason?: string } {
  if (input.status !== "requested") return { ok: false, reason: "This request has already been answered." };
  if (!input.isRecipient) return { ok: false, reason: "Only the person who received the request can answer it." };
  return { ok: true };
}

/** May this user read this thread? Parties only. */
export function canView(input: { isParty: boolean }): { ok: boolean; reason?: string } {
  return input.isParty ? { ok: true } : { ok: false, reason: "You are not part of this conversation." };
}
