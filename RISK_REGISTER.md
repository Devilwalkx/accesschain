# AccessChain – Risk register (DRAFT)

Likelihood/impact are qualitative (L/M/H) and unvalidated. "Evidence" shows what exists today, not what a launch requires.

## Product and safety risks (from the gap register A1–A12)

| ID | Risk | L | I | Response | Evidence today | Residual / owner |
|---|---|---|---|---|---|---|
| A1 | Accessible destination, unusable final approach | M | H | Model arrival/approach/entrance separately; incomplete journey ⇒ unknown | Tests: barrier on approach, missing segments | Needs real pavement/kerb surveys. Field team |
| A2 | One accessibility label hides different needs | H | H | Per-requirement matching (steps, width, distance, rest gaps, toilet, lift, assistance) | Tested | Requirement set may omit needs. User testing |
| A3 | Stale lift feed looks live | M | H | Expiry; expired ⇒ unknown; recheck diff | Tested incl. demo | Pre-departure scheduled recheck not built |
| A4 | User report conflicts with venue/operator | H | M | Conflict state; both visible; decisive conflict ⇒ insufficient | Tested | Moderation capacity unknown |
| A5 | Quiet street is private/blocked | M | H | Only licensed route data + field verification; no invented paths | By design, no provider | Provider licence and data quality unverified |
| A6 | Business pays to appear accessible | M | H | Ranking ignores tier; assessment independent of subscription | Tested (ranking) | Policy and contract wording need review |
| A7 | Reports reveal disability/home location | M | H | Strict schema, no identity fields, PII flags, pseudonym dropped | Tested (heuristic) | Heuristics miss things; moderation required |
| A8 | Precise location when a postcode would do | M | M | Manual origin; one-shot coarse foreground location; no background permission | Config + code | Not device-tested |
| A9 | API failure becomes stale confident route | M | H | Timeout/validation; visible unavailable; no cache all-clear | Tested | Offline behaviour for saved trips not built |
| A10 | Planning answer ignores later change | M | H | `liveChanges` on saved itineraries | Tested | No push notification of changes yet |
| A11 | Map/UI excludes intended users | M | H | Text-first UI, roles/labels, large targets, no colour-only meaning | Code only | **No screen-reader or real-device testing done** |
| A12 | "Verified" lacks a standard | M | H | Badge needs scope, method, verifier type, date, lapse; venue self-report labelled | Tested | Legal review of wording |

## Security/privacy risks

| ID | Risk | L | I | Response | Evidence today | Residual |
|---|---|---|---|---|---|---|
| S1 | Crypto composition flaw | L | H | Audited primitives, AAD binding, no fallback | Unit tests + mutation checks | **Needs independent cryptographic review** |
| S2 | Weak RNG on a device | L | H | Fail closed | Code | Not verified on real iOS/Android (T-12) |
| S3 | Key loss ⇒ permanent data loss | M | M | Honest UI: the Android app says answers cannot be restored (no recovery code is offered); re-entering takes about a minute | `e2e` lost-key test (T-41) | A designed, tested restore is not built (D-026) |
| S4 | Trusted-device/key substitution on enrol/share | M | H | Sharing not built | – | Design must exist before any sharing (D-005) |
| S5 | No authentication/authorisation service yet | – | H | Matrix defined; RLS tested | DB only | **Not built; cannot claim access control** |
| S6 | Third-party route provider sees location | H | M | Coarse origin, disclosure | Code | Provider not chosen; transfers unassessed |
| S7 | Dependencies and build tooling vulnerabilities | M | M | Lockfile, audit | `npm audit`: core runtime deps clean; 22 findings (15 high) in Expo/React Native build tooling; 0 critical | Re-audit before any release; track upstream fixes |
| S8 | Photo bystanders/faces | M | M | Warning, moderation | Policy | No automated face handling (and none planned: no face recognition) |
| S9 | Moderator/partner account takeover | M | H | MFA, audit | Audit schema | Auth not built |

## Live-data risks (added when real data was connected)

| ID | Risk | Response | Residual |
|---|---|---|---|
| L1 | Community notes are wrong, vandalised or old | Date required; 2-year limit (unvalidated); shown as "written by contributors"; never presented as checked | Even a recent wrong edit would be believed. Needs field checks |
| L2 | Users read "We can't be sure yet" as useless and ignore the app | The card lists what *was* checked; plain advice to phone the venue | Needs user testing with older people |
| L3 | Users read "No lift problem reported" as "lift working" | Wording is exactly "No lift problem reported"; feed outage = unchecked | Feed completeness unknown |
| L4 | TfL/OSM change formats, block the app, or rate-limit anonymous use | Validation → "insufficient evidence"; visible notices; CI live-smoke job; no app key bundled | A shared anonymous quota could fail under real use |
| L5 | Terms of use not met (TfL licence unread; Nominatim policy for apps; ODbL) | Attribution shown; no bundling; cache; identifying User-Agent on the phone | **Must be checked by a person** |
| L6 | Location/IP exposure to third parties | Consent screen; rounded location; no needs sent; disclosure in Privacy | IP exposure cannot be removed |
| L7 | Venue is far from stations offered; only a handful of venues and 5 stations | Scope is deliberately small | No real coverage claim |

## Business risks

| ID | Risk | Response |
|---|---|---|
| B1 | Existing products already cover the whole journey well enough | Phase 0 hands-on competitor trials with real users (not done; sources unreachable) |
| B2 | Verification cost per venue exceeds institutional willingness to pay | Measure effort per venue in the 50-venue pilot; test campus/hotel payers |
| B3 | Feed licences forbid storing/redistribution as planned | Check each licence before import |
| B4 | Over-claiming harms users and the company | Claims policy in SPEC.md, enforced in labels and tests |
| B5 | Data goes stale faster than we can verify | Expiry by default; show age on every fact |

## Not claimed

No accuracy percentage, no "accessible/safe" claim, no GDPR-compliance claim, no "production ready" claim is made about this build.

## Added in the Android pass (2026-10-17)

| ID | Risk | L | I | Response | Evidence today | Residual / owner |
|---|---|---|---|---|---|---|
| N1 | Public Nominatim server used without a proxy: policy requires being able to switch service without an app update and counts all users together; it also has a clause on code written with AI assistants | H (for any real user base) | M | 1 request/s, cache, no autocomplete, UA, fixed list of ten places | Unit tests (T-44) | No proxy; owner decision (docs/SERVICE_TERMS_AUDIT.md) |
| N2 | TfL licence applies "from the date of registration"; the app calls the API anonymously and bundles no key; the current licence page could not be read (bot check), an archived copy was | M | M | Attribution shown; two calls per trip | Audit document | Owner to register/ask TfL; branding guidelines unread |
| N3 | Community place notes are old or wrong and could be read as a promise | H | H | Dated or not counted; "not checked by us"; next steps point to the venue | T-38, T-46 | No field verification |
| N4 | Older users misread "not confirmed" as "no" or "yes" | M | H | Journey-first layout, four parts, plain words, icon + words | Not testable without people | Usability sessions NOT RUN (docs/USABILITY_SESSION_PLAN.md) |
