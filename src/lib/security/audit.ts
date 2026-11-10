import { db } from "../db/client";
import { log } from "../log";

/**
 * Audit trail (spec §5): decrypted reads by admins, logins, exports, deletes,
 * role changes. Never put PII or decrypted values in `meta`.
 */
export type AuditAction =
  | "auth.signup"
  | "auth.verify"
  | "auth.login"
  | "auth.login_failed"
  | "auth.locked"
  | "auth.logout_all"
  | "auth.password_reset_requested"
  | "auth.password_reset"
  | "auth.password_changed"
  | "auth.mfa_enabled"
  | "auth.mfa_failed"
  | "admin.decrypt_read"
  | "admin.role_change"
  | "admin.verify_candidate"
  | "admin.trial_extended"
  | "admin.force_reset"
  | "admin.deactivate"
  | "admin.interview_retake"
  | "account.export"
  | "account.delete"
  | (string & {});

export async function audit(
  action: AuditAction,
  opts: { actorUserId?: string | null; targetType?: string; targetId?: string; ip?: string | null; meta?: Record<string, unknown> } = {},
) {
  try {
    await db().auditLog.create({
      data: {
        action,
        actorUserId: opts.actorUserId ?? null,
        targetType: opts.targetType,
        targetId: opts.targetId,
        ip: opts.ip ?? null,
        meta: (opts.meta ?? undefined) as never,
      },
    });
  } catch (err) {
    log.error("audit.write_failed", { action, err: String(err) });
  }
}
