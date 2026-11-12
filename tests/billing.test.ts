import { afterEach, describe, expect, it } from "vitest";
import { PLANS, getPriceId } from "../src/lib/billing/stripe";
import { statusFromStripe } from "../src/lib/billing/subscriptions";
import { resetEnvCache } from "../src/lib/env";

const original = { ...process.env };
afterEach(() => {
  Object.assign(process.env, original);
  delete process.env.STRIPE_PRICE_PLATFORM_MONTHLY;
  delete process.env.STRIPE_PRICE_PLATFORM_ANNUAL;
  resetEnvCache();
});

describe("statusFromStripe", () => {
  it.each([
    ["trialing", "trial"],
    ["active", "active"],
    ["past_due", "past_due"],
    ["canceled", "cancelled"],
    ["incomplete", "none"],
    ["incomplete_expired", "none"],
    ["unpaid", "expired"],
    ["paused", "cancelled"],
  ] as const)("maps Stripe %s → %s", (stripeStatus, expected) => {
    expect(statusFromStripe(stripeStatus)).toBe(expected);
  });

  it("maps an unknown status to none (no access by default)", () => {
    expect(statusFromStripe("not_a_real_status" as never)).toBe("none");
  });
});

describe("PLANS", () => {
  it("monthly is $49, annual is $299", () => {
    expect(PLANS.monthly.priceUsd).toBe(49);
    expect(PLANS.annual.priceUsd).toBe(299);
  });

  it("annual is cheaper per month than monthly", () => {
    expect(PLANS.annual.priceUsd / 12).toBeLessThan(PLANS.monthly.priceUsd);
  });
});

describe("getPriceId", () => {
  it("throws when the price is not configured", () => {
    expect(() => getPriceId("monthly")).toThrow(/Billing is not configured/);
    expect(() => getPriceId("annual")).toThrow(/Billing is not configured/);
  });

  it("returns the configured price id", () => {
    process.env.STRIPE_PRICE_PLATFORM_MONTHLY = "price_monthly_test";
    process.env.STRIPE_PRICE_PLATFORM_ANNUAL = "price_annual_test";
    resetEnvCache();
    expect(getPriceId("monthly")).toBe("price_monthly_test");
    expect(getPriceId("annual")).toBe("price_annual_test");
  });
});
