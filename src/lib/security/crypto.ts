import crypto from "node:crypto";
import { env } from "../env";

/**
 * Application-level encryption for private profile fields and interview answers.
 * AES-256-GCM, random 96-bit IV per value. The field name is bound in as
 * additional authenticated data, so ciphertext copied into another column
 * fails to decrypt instead of leaking into the wrong place.
 *
 * Stored format: v<keyVersion>:<iv>:<tag>:<ciphertext>   (base64url parts)
 * Rotation: set the new key as ENCRYPTION_KEY, bump ENCRYPTION_KEY_VERSION,
 * move the old key to ENCRYPTION_KEY_PREVIOUS, then re-encrypt (needsReencrypt).
 */

function keys() {
  const e = env();
  const map = new Map<number, Buffer>([[e.ENCRYPTION_KEY_VERSION, Buffer.from(e.ENCRYPTION_KEY, "base64")]]);
  if (e.ENCRYPTION_KEY_PREVIOUS) map.set(e.ENCRYPTION_KEY_VERSION - 1, Buffer.from(e.ENCRYPTION_KEY_PREVIOUS, "base64"));
  return { current: e.ENCRYPTION_KEY_VERSION, map };
}

export function encrypt(plaintext: string, field: string): string {
  const { current, map } = keys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", map.get(current)!, iv);
  cipher.setAAD(Buffer.from(field, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [`v${current}`, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function decrypt(payload: string, field: string): string {
  const [ver, ivB64, tagB64, ctB64] = payload.split(":");
  const version = Number(ver?.slice(1));
  if (!ver?.startsWith("v") || !Number.isInteger(version) || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error("Malformed ciphertext");
  }
  const key = keys().map.get(version);
  if (!key) throw new Error(`No key for encryption version ${version}`);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(field, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

export const encryptOptional = (v: string | null | undefined, field: string) => (v ? encrypt(v, field) : null);
export const decryptOptional = (v: string | null | undefined, field: string) => (v ? decrypt(v, field) : null);

export const needsReencrypt = (payload: string) => payload.split(":")[0] !== `v${keys().current}`;

/** 32 random bytes, URL-safe. For verify/reset tokens. Store only sha256(token). */
export const randomToken = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/** Random uppercase code without look-alike characters (O/0, I/1). */
export function randomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

export function timingSafeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
