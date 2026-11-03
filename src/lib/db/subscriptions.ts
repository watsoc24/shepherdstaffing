import { db } from "./client";

export const upsert = (input: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}) =>
  db().subscription.upsert({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    create: input,
    update: input,
  });

export const findByStripeId = (stripeSubscriptionId: string) =>
  db().subscription.findUnique({ where: { stripeSubscriptionId } });

export const latestForUser = (userId: string) =>
  db().subscription.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
