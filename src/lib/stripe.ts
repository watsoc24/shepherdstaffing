import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  client ??= new Stripe(env.stripeSecretKey, { appInfo: { name: "Irish Dance Connect" } });
  return client;
}
