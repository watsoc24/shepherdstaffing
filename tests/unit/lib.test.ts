import { describe, expect, it } from "vitest";
import { parseMoneyToCents, platformFeeCents } from "@/lib/money";
import { safeNext } from "@/lib/safe-redirect";
import { buildCsp } from "@/lib/csp";
import { claimSchema, feisSchema, listingSchema, searchTerm, signUpSchema } from "@/lib/validation";

describe("platform fee", () => {
  it("is 7% rounded to the nearest cent", () => {
    expect(platformFeeCents(10000)).toBe(700);
    expect(platformFeeCents(2500)).toBe(175);
    expect(platformFeeCents(1999)).toBe(140); // 139.93 -> 140
  });
  it("rejects invalid amounts", () => {
    expect(() => platformFeeCents(0)).toThrow();
    expect(() => platformFeeCents(10.5)).toThrow();
  });
});

describe("money parsing", () => {
  it("parses prices", () => {
    expect(parseMoneyToCents("120")).toBe(12000);
    expect(parseMoneyToCents("120.5")).toBe(12050);
    expect(parseMoneyToCents("$45.99")).toBe(4599);
  });
  it("rejects junk", () => {
    for (const bad of ["", "-5", "1e5", "12.345", "abc", "1,000"]) expect(parseMoneyToCents(bad)).toBeNull();
  });
});

describe("safeNext (open redirect protection)", () => {
  it("allows relative paths", () => {
    expect(safeNext("/marketplace/abc")).toBe("/marketplace/abc");
    expect(safeNext("/feis?where=Boston")).toBe("/feis?where=Boston");
  });
  it("blocks external and protocol-relative URLs", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "/\t/evil.test", "/%09/evil.test".replace("%09", "\t"), "javascript:alert(1)", "/a\r\nb", 5]) {
      expect(safeNext(bad)).toBe("/account");
    }
  });
});

describe("CSP", () => {
  it("uses a nonce and blocks framing and plugins in production", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("'nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});

describe("search terms", () => {
  it("strips characters that could change PostgREST filters", () => {
    expect(searchTerm('Boston",status.eq.pending')).toBe("Bostonstatuseqpending");
    expect(searchTerm("St. Louis (MO)")).toBe("St Louis MO");
    expect(searchTerm("Ó Riada")).toBe("Ó Riada");
  });
});

describe("form validation", () => {
  it("requires adult confirmation on signup", () => {
    const r = signUpSchema.safeParse({ displayName: "Sam", email: "a@b.co", password: "longenough1", role: "parent", terms: "yes" });
    expect(r.success).toBe(false);
  });
  it("rejects unknown roles at signup", () => {
    const r = signUpSchema.safeParse({ displayName: "Sam", email: "a@b.co", password: "longenough1", role: "platform_admin", adult: "yes", terms: "yes" });
    expect(r.success).toBe(false);
  });
  it("enforces listing price minimum and strips control characters", () => {
    const base = { title: "Dress\u0000", category: "solo_dress", size_label: "10", condition: "good", city: "A", region: "B", country: "US", shipping: "0" };
    expect(listingSchema.safeParse({ ...base, price: "5" }).success).toBe(false);
    const ok = listingSchema.safeParse({ ...base, price: "150" });
    expect(ok.success && ok.data.title).toBe("Dress");
  });
  it("only accepts https registration links for feis events", () => {
    const base = { name: "Test Feis", startsOn: "2027-01-01", endsOn: "2027-01-02", city: "X", country: "US" };
    expect(feisSchema.safeParse({ ...base, registrationUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(feisSchema.safeParse({ ...base, registrationUrl: "http://example.com" }).success).toBe(false);
    expect(feisSchema.safeParse({ ...base, registrationUrl: "https://example.com/reg" }).success).toBe(true);
    expect(feisSchema.safeParse({ ...base, endsOn: "2026-12-31", registrationUrl: "https://e.com" }).success).toBe(false);
  });
  it("requires a school name or id for claims", () => {
    const base = { claimantTitle: "Owner", contactEmail: "a@b.co", evidence: "We are on the website." };
    expect(claimSchema.safeParse(base).success).toBe(false);
    expect(claimSchema.safeParse({ ...base, proposedName: "Scoil Rince" }).success).toBe(true);
  });
});
