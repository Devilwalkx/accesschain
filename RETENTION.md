# AccessChain – Retention (DRAFT PROPOSALS, none validated)

There is **no universal UK GDPR retention period**. Each entry needs a documented purpose, a justification and review by the privacy owner. Values marked *proposal* are starting points for discussion only. This document does not invent statutory periods; where law may impose one, it is marked **check**.

| Data | Where | Purpose | Proposal | Deletion trigger / notes |
|---|---|---|---|---|
| Private profile and saved trips (ciphertext) | Device; optional backup `private_items` | Provide planner; restore on new device | Life of account | User deletes item/account ⇒ tombstone written, rows removed |
| Recovery blob (ciphertext) | `recovery_blobs` | Key recovery | Life of account | Removed with account or when user rotates secret |
| Tombstones | `tombstones` | Prevent resurrection on backup restore | Until the oldest backup containing the item has expired | Purged after backup horizon |
| Backups of the above | Provider backups | Disaster recovery | *Proposal:* short fixed horizon, e.g. 30 days | Deletion "beyond use" until expiry; explain to users |
| Account and device records | `accounts`, devices | Authentication, security | Life of account + short grace period for abuse handling (*proposal*) | Account deletion |
| Report queue (pending/rejected) incl. notes and pseudonym | `report_queue` | Moderation | *Proposal:* 30 days after decision (column `purge_after` is a placeholder) | Purge job (**not built**) |
| Approved public observations | `observations` | Public access info | Until expiry; kept as history while useful for dispute/audit. Needs a rule for very old data | They contain no contributor identity |
| Observation history | `observation_history` | Accountability for edits | Same as observations. **check** whether partner/moderator ids need shorter retention | Append-only by design |
| Verification badges | `verification_badges` | Public assurance with lapse | Lapse date; history kept for audit | |
| Photos | Private storage | Evidence for observation | *Proposal:* delete original upload when observation expires or is rejected; keep only the sanitised derivative while published | Bystander complaints ⇒ immediate removal |
| Feed snapshots | `feed_snapshots` | Provenance, licence compliance | Per licence terms (**check each licence**) | |
| Audit events (no content) | Logs | Security investigation | *Proposal:* 90 days; longer only for a recorded incident | Never contain content or coordinates |
| Support diagnostics | Support tooling | Troubleshooting | Case life + short tail | No content |
| Billing records (future) | Payment provider | Tax/accounting | **check** applicable statutory requirement | Not built |

## Deletion and shared records

Account deletion removes private ciphertext and recovery data. It does **not** delete lawfully retained public history (observations, moderation actions) or copies the user exported. Contributions stay without contributor identity. Legal holds must suspend deletion for specific records and be logged.

## Open items

Backup horizon and restore/delete drill (SECURITY_TESTS T-30); purge jobs; retention for moderator/partner action logs; photo lifecycle; statutory checks for billing and any complaints records.
