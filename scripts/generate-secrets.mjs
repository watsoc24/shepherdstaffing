// Prints fresh values for JWT_SECRET, ENCRYPTION_KEY and CRON_SECRET.
// Paste them into Vercel env vars or your local .env — never into chat or git.
import crypto from "node:crypto";

console.log(`JWT_SECRET="${crypto.randomBytes(64).toString("base64url")}"`);
console.log(`ENCRYPTION_KEY="${crypto.randomBytes(32).toString("base64")}"`);
console.log(`CRON_SECRET="${crypto.randomBytes(32).toString("base64url")}"`);
