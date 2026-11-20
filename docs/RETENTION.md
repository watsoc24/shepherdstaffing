# Data retention

How long Fit For Ministry keeps personal data, and how it is deleted.
Counts as the retention policy referenced by the privacy policy.

## Accounts

| Data | Kept | Then |
|---|---|---|
| Active account + profile, screening, matches, messages, interview, subscription | While the account is active | Deleted on request (below) |
| Closed account — personal data | Marked `deletedAt` at closure | Purged within **30 days** |
| Closed account — audit events (`account.delete`, etc.) | 1 year | Purged; events contain no personal content |
| Financial records (Stripe references, fees) | As the law requires (tax/accounting) | Purged when the legal period ends |

## Other records

| Data | Kept | Then |
|---|---|---|
| Inquiries (won or lost) | Length of the engagement + 2 years | Purged |
| Engagements | Length of the engagement + 2 years | Purged |
| Reports (moderation) | 1 year after resolution | Purged |
| PreQual assessments (signed-in) | With the account | Deleted with the account |
| PreQual assessments (anonymous lead) | 1 year | Purged |
| Audit log (all actions) | 1 year | Purged; contains no PII or decrypted values |
| Chat history (FitCoach) | With the account | Deleted with the account |

## Deletion

- A user closes their account from **Account → Close your account** (type
  `DELETE`). Sessions are revoked immediately; `deletedAt` is set.
- An active paid subscription must be cancelled first (Billing → Manage),
  so we never take money from an account that no longer exists.
- Purge is a hard delete of the user row and everything that cascades from
  it (candidate/church profile, assessments, matches, threads, messages,
  interview, consents, chat). Stripe customer records are handled by
  Stripe's own retention; the customer id is removed from our side.
- Backups: database backups age out on their normal cycle (≤ 30 days), so
  a deleted account is gone from backups within 30 days of the purge.
- An admin may deactivate (not delete) an account for abuse; deactivation
  preserves the record for moderation and is reversible by an admin.

## What is never kept

Card numbers (Stripe only), passwords (bcrypt hashes only), plaintext
private profile fields or interview answers (AES-256-GCM ciphertext only),
one-time codes, or verification tokens past their expiry.
