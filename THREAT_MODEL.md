# AccessChain – Threat model (DRAFT)

Method: assets → actors → per-threat mitigation → test reference. Mitigations marked **(code)** are implemented and tested; **(design)** are designed but not built; **(open)** need a decision or external review. Test IDs refer to SECURITY_TESTS.md.

## Assets

| Asset | Sensitivity |
|---|---|
| Requirements profile, saved trips | Can reveal health information even without a diagnosis; reveals home/destination patterns |
| Content key, recovery secret | Compromise decrypts all private content |
| Public observation integrity | Wrong data can send a person to an inaccessible place |
| Partner and moderator accounts | Can alter public facts |
| Feed licences and quotas | Contractual/commercial |
| Photos | Faces, interiors, GPS metadata |

## Threats

| ID | Threat | Mitigation | Status | Tests |
|---|---|---|---|---|
| TM-1 | Server/staff reads a private profile | Client-side encryption; server stores ciphertext; DB has no plaintext columns; support has no content access | code + design | T-01, T-02, T-20 |
| TM-2 | Ciphertext swapped between items/accounts or rolled back | AAD binds account, item and version | code | T-03 |
| TM-3 | Tampered ciphertext/nonce | AEAD authentication, throws; no plaintext fallback | code | T-04 |
| TM-4 | Weak randomness on device | `installSecureRandom` fails closed; no Math.random; nonce uniqueness test | code (device **open**) | T-05, T-12 |
| TM-5 | Password reset leaks content | No server key exists; recovery is user-held secret or trusted device | code + design | T-06 |
| TM-6 | Recovery secret mistyped/guessed | 256-bit secret; Crockford alphabet tolerant of O/I/L; wrong length rejected | code | T-07 |
| TM-7 | Stale live data presented as current ("lift working") | Freshness expiry; expired ⇒ unknown; recheck diff | code | T-08, T-09 |
| TM-8 | Conflicting sources resolved silently in someone's favour | Conflict state; decisive disagreement ⇒ insufficient evidence | code | T-10 |
| TM-9 | Missing data treated as pass | Aggregation never yields fit without evidence; incomplete journey ⇒ unknown | code | T-11 |
| TM-10 | Malicious partner edits or suppression of adverse report | Append-only store, role rules, DB triggers, history | code | T-14, T-15 |
| TM-11 | Spam / abusive / malformed reports; stored XSS in notes | Strict schema, length caps, rate limit, duplicate suppression, moderation; output must be rendered as text (React Native Text; web dashboard must escape) | code + design | T-16 |
| TM-12 | Personal data in public notes | PII flagging; approval refuses unredacted notes | code (heuristic, imperfect) | T-17 |
| TM-13 | Photo GPS/EXIF leak, bystander faces | Re-encode on-device, strip + verify; face review is manual | code (device **open**) | T-13 |
| TM-14 | Location oversharing to route provider | Foreground one-shot, coarse; rounding; disclosure; no background permission | code (provider **open**) | T-18 |
| TM-15 | Third-party API outage/quota/garbage | Timeout, validation, visible unavailable | code | T-19 |
| TM-16 | Cross-account data access via API | Server authorisation per object + RLS | design + RLS tested | T-20, T-21 |
| TM-17 | Deleted data resurrects from backup | Tombstones honoured on restore | code | T-22 |
| TM-18 | Sponsored/paid ranking distorts access advice | Ranking function ignores commercial fields | code | T-23 |
| TM-19 | Logs/crash reports expose coordinates or profile | `redactForLog`; no content logging policy | code (crash tooling **open**) | T-24 |
| TM-20 | Hostile content/instructions in reports or feeds cause actions | Reports are data only; no tool execution; schema-validated | code | T-16 |
| TM-21 | Supply-chain / dependency compromise | Pinned lockfile, audited crypto libraries, no postinstall review yet | open | T-26 |
| TM-22 | Device theft with unlocked app | Keys in secure storage, this-device-only; biometric gating of key use **not built** | open | – |
| TM-23 | Over-claiming ("verified", "accessible") | Badge rules, claims policy, label tests | code + policy | T-25 |
| TM-24 | Compromised moderator/partner credentials | Auth, MFA, session management | design only; **no auth service built** | – |
| TM-25 | Key substitution when enrolling a device or sharing | Sharing not built; device enrolment requires authenticated key exchange | open (D-005) | – |

## Out of scope / residual

Screenshots, copies and exports already in someone's hands; a compromised or rooted device; a user choosing to share their own profile; physical environment changes after observation. A verification badge describes what was observed on a date, not a permanent state.
