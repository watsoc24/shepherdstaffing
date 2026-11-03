import { afterEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, needsReencrypt, randomCode, randomToken, sha256 } from "@/lib/security/crypto";
import { resetEnvCache } from "@/lib/env";

const original = { ...process.env };
afterEach(() => {
  Object.assign(process.env, original);
  delete process.env.ENCRYPTION_KEY_PREVIOUS;
  resetEnvCache();
});

describe("AES-256-GCM field encryption", () => {
  it("round-trips, including unicode and long text", () => {
    for (const v of ["", "Called in 2009 at a youth camp ✝️", "x".repeat(5000)]) {
      expect(decrypt(encrypt(v, "candidate.callingNotes"), "candidate.callingNotes")).toBe(v);
    }
  });

  it("uses the v1:iv:tag:ciphertext format with a fresh IV every time", () => {
    const a = encrypt("same", "f");
    const b = encrypt("same", "f");
    expect(a).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]*$/);
    expect(a).not.toBe(b);
  });

  it("fails if ciphertext is moved to another field", () => {
    expect(() => decrypt(encrypt("secret", "candidate.familyNotes"), "candidate.philosophy")).toThrow();
  });

  it("detects tampering", () => {
    const parts = encrypt("secret value", "f").split(":");
    const ct = Buffer.from(parts[3], "base64url");
    ct[0] ^= 1;
    parts[3] = ct.toString("base64url");
    expect(() => decrypt(parts.join(":"), "f")).toThrow();
  });

  it("supports key rotation via version prefix", () => {
    const old = encrypt("pre-rotation", "f"); // v1
    process.env.ENCRYPTION_KEY_PREVIOUS = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    process.env.ENCRYPTION_KEY_VERSION = "2";
    resetEnvCache();
    expect(decrypt(old, "f")).toBe("pre-rotation");
    expect(needsReencrypt(old)).toBe(true);
    const fresh = encrypt("post", "f");
    expect(fresh.startsWith("v2:")).toBe(true);
    expect(needsReencrypt(fresh)).toBe(false);
  });
});

describe("tokens", () => {
  it("are 32 random bytes and hash deterministically", () => {
    const t = randomToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(sha256(t)).toBe(sha256(t));
    expect(sha256(t)).not.toContain(t);
  });
  it("display codes avoid look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(randomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});
