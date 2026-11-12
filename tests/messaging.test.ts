import { describe, expect, it } from "vitest";
import { canRespond, canSend, canStartThread, canView } from "../src/lib/messaging/rules";

describe("M6 messaging rules", () => {
  it("stops trial members from contacting a match", () => {
    const r = canStartThread({ canContact: false, hasMatch: true, matchDismissed: false, existingStatus: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("membership");
  });

  it("requires a live match to start a thread", () => {
    const noMatch = canStartThread({ canContact: true, hasMatch: false, matchDismissed: false, existingStatus: null });
    expect(noMatch.ok).toBe(false);
    const dismissed = canStartThread({ canContact: true, hasMatch: true, matchDismissed: true, existingStatus: null });
    expect(dismissed.ok).toBe(false);
  });

  it("refuses a second thread while one is open, but allows re-request after a decline", () => {
    const open = canStartThread({ canContact: true, hasMatch: true, matchDismissed: false, existingStatus: "accepted" });
    expect(open.ok).toBe(false);
    const declined = canStartThread({ canContact: true, hasMatch: true, matchDismissed: false, existingStatus: "declined" });
    expect(declined.ok).toBe(true);
    const closed = canStartThread({ canContact: true, hasMatch: true, matchDismissed: false, existingStatus: "closed" });
    expect(closed.ok).toBe(true);
  });

  it("lets both parties write only once a thread is accepted", () => {
    expect(canSend({ status: "accepted", isParty: true, isBlocked: false }).ok).toBe(true);
    expect(canSend({ status: "requested", isParty: true, isBlocked: false }).ok).toBe(false);
    expect(canSend({ status: "declined", isParty: true, isBlocked: false }).ok).toBe(false);
    expect(canSend({ status: "closed", isParty: true, isBlocked: false }).ok).toBe(false);
    expect(canSend({ status: "accepted", isParty: false, isBlocked: false }).ok).toBe(false);
    expect(canSend({ status: "accepted", isParty: true, isBlocked: true }).ok).toBe(false);
  });

  it("lets only the recipient answer a request", () => {
    expect(canRespond({ status: "requested", isRecipient: true }).ok).toBe(true);
    expect(canRespond({ status: "requested", isRecipient: false }).ok).toBe(false);
    expect(canRespond({ status: "accepted", isRecipient: true }).ok).toBe(false);
  });

  it("keeps threads private to their parties", () => {
    expect(canView({ isParty: true }).ok).toBe(true);
    expect(canView({ isParty: false }).ok).toBe(false);
  });
});
