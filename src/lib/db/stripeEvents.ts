import { db } from "./client";

/**
 * Claims an event for processing. Returns false if it was already processed
 * (replayed webhook), using the primary key as the idempotency lock.
 */
export async function claim(eventId: string, type: string): Promise<boolean> {
  try {
    await db().stripeEvent.create({ data: { eventId, type } });
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }
}

/** Release a claim when processing failed, so Stripe's retry can succeed. */
export const release = (eventId: string) => db().stripeEvent.delete({ where: { eventId } }).catch(() => undefined);
