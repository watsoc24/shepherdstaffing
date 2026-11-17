import { describe, expect, it } from "vitest";
import { isDeletable, stripUserSecrets } from "../src/lib/compliance/account";

describe("M9 compliance: export redaction and deletion rules", () => {
  it("strips every secret from a user row and keeps the rest", () => {
    const user = {
      id: "u1",
      email: "a@example.com",
      name: "Alex",
      role: "candidate",
      passwordHash: "$2b$12$secret",
      verifyTokenHash: "v",
      verifyTokenExpires: new Date(),
      resetTokenHash: "r",
      resetTokenExpires: new Date(),
      mfaSecretEnc: "m",
      mfaPendingSecretEnc: "p",
      mfaBackupCodeHashes: ["h1"],
      emailVerified: true,
    };
    const stripped = stripUserSecrets(user);
    expect(stripped).not.toHaveProperty("passwordHash");
    expect(stripped).not.toHaveProperty("verifyTokenHash");
    expect(stripped).not.toHaveProperty("verifyTokenExpires");
    expect(stripped).not.toHaveProperty("resetTokenHash");
    expect(stripped).not.toHaveProperty("resetTokenExpires");
    expect(stripped).not.toHaveProperty("mfaSecretEnc");
    expect(stripped).not.toHaveProperty("mfaPendingSecretEnc");
    expect(stripped).not.toHaveProperty("mfaBackupCodeHashes");
    expect(stripped.email).toBe("a@example.com");
    expect(stripped.name).toBe("Alex");
  });

  it("lets trial, expired, and free accounts delete, but not paid ones", () => {
    expect(isDeletable("none")).toBe(true);
    expect(isDeletable("trial")).toBe(true);
    expect(isDeletable("expired")).toBe(true);
    expect(isDeletable("cancelled")).toBe(true);
    expect(isDeletable("active")).toBe(false);
    expect(isDeletable("past_due")).toBe(false);
  });
});
