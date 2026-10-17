# AccessChain – Permissions (DRAFT)

Authorisation is enforced **server-side on every endpoint, file, job, websocket and export**. Hiding a button is not authorisation. Row-level security (tested in `packages/db`) is defence in depth, not the only control.

## Roles

| Role | Description |
|---|---|
| Traveller | Account holder. Owns their private profile and trips. |
| Contributor | A traveller submitting a report (pseudonymous in public output). |
| Partner | Venue representative, scoped to one venue. |
| Moderator | Reviews reports, records disputes, rejects abusive content. |
| Verifier | Paid tester / auditor adding field verification (scoped to assigned venues). |
| Feed service | System identity importing licensed feeds. |
| Support | Operational help. **No content access.** |
| Administrator | Manages roles and deployments. No standing access to private ciphertext keys (none exist). |

## Matrix (Y = allowed, own = own records only, – = denied)

| Action | Traveller | Contributor | Partner | Moderator | Verifier | Feed | Support |
|---|---|---|---|---|---|---|---|
| Read public venue facts | Y | Y | Y | Y | Y | Y | Y |
| Read/write own private ciphertext | own | own | own | own | own | – | – |
| Read another user's private ciphertext | – | – | – | – | – | – | – |
| Decrypt any private content | own device only | own device only | own | own | own | – | – |
| Submit a report | Y | Y | – | – | – | – | – |
| Add `venue_report` observation | – | – | own venue, own source id | – | – | – | – |
| Add `field_verification` observation | – | – | – | – | assigned venues | – | – |
| Add `operator_feed` observation | – | – | – | – | – | licensed feeds only | – |
| Withdraw an observation | – | – | **own statements only** | Y (logged) | own | – | – |
| Withdraw/reject a community report | – | – | **–** | Y (logged) | – | – | – |
| Record a dispute | – | – | **–** | Y (logged) | – | – | – |
| Delete or edit an observation's value | – | – | – | – | – | – | – (nobody; append-only) |
| Approve a user report to public | – | – | – | Y | – | – | – |
| Issue verification badge | – | – | – | – | Y (scope, method, date required) | – | – |
| View moderation queue (includes notes) | – | – | – | Y | – | – | – |
| Export/delete own data | Y | Y | Y | Y | Y | – | on request, recorded |
| View non-content diagnostics | – | – | – | – | – | – | Y |
| Influence ranking via subscription | – | – | – | – | – | – | – |

## Rules

1. A partner's subscription never changes assessment, evidence or ranking.
2. Every state-changing action on public facts writes an `observation_history` row naming the actor.
3. Moderators cannot author facts; they can only reject, dispute, or approve queued reports.
4. Support access to anything beyond non-content diagnostics requires an owner-initiated, recorded disclosure.
5. Offboarding a partner or moderator revokes sessions immediately and leaves their historical entries in place.
6. Sharing itineraries between users is **not implemented** (D-005).

## Status

Rules 2 and 3 and the partner/moderator limits are implemented in `core/facts.ts` and the DB triggers and tested. **Authentication, session management, MFA and the API layer that would enforce this matrix are not built.** The matrix is a requirement, not a claim of implementation.


## What the Android app asks the phone for (as built, build 0.2.0)

| Android permission | Requested? | Why |
|---|---|---|
| `INTERNET` | Yes (Expo adds it; not blocked) | Live data from TfL and OpenStreetMap, only after the consent screen. The demonstration and everything else work without it. |
| `ACCESS_COARSE_LOCATION` | Yes, asked in context | Only when the person taps "Where I am now", after the screen explains it. One-shot, rounded to about 100 m, never stored. Refusal (including "don't ask again") is handled: a clear message, a button to the phone's settings, and the station and postcode alternatives. |
| `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` | Blocked | Not needed. |
| `CAMERA`, `RECORD_AUDIO` | Blocked | Not needed. The photo picker for reports needs no permission. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Blocked | Not needed. |
| `SYSTEM_ALERT_WINDOW`, `VIBRATE` | Blocked | Not needed. |

CI fails if any blocked permission appears in the generated manifest (`.github/workflows/build.yml`, job `android-apk`). Cloud backup is off (`allowBackup=false`), so the encrypted answers are not copied to Google Drive. Predictive back is on.
