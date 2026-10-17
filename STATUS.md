# AccessChain – Status report

## Phone delivery update (latest)
- **CI (GitHub Actions, run 2 on commit 94bb3fd): passed.** Typecheck, 67 unit/database tests, web build, 36 browser tests (before the HTTPS guard was added) and the Android release build all succeeded on GitHub's runners. Artifacts produced: `accesschain-android-test-apk` (28 MB, debug-signed, testing only) and `accesschain-web`. Locally the browser suite is now 39 tests; the commit adding the last 3 is pushed after this note and is covered by the next CI run.
- **Never run on a physical phone.** The APK builds but nobody has installed or launched it yet; native modules (secure store, secure random, image picker, location) are unproven on a device. iPhone: web version only; no installable iOS build.
- Details: README "Run it on a phone", DECISIONS D-015 to D-017, SECURITY_TESTS T-35/T-36.


Generated at the end of build stage 1–3 (design, vertical slice, negative tests). Synthetic data only.

## Implemented
- Domain logic: evidence resolution with source/observed/retrieved/expiry, conflict handling, deterministic three-state matching (steps, lift, width, walking distance, rest gaps, toilet, assistance), journey completeness, evidence-backed alternatives, saved itinerary snapshots with live-change diff, screen-reader-first text itinerary.
- Private vault: XChaCha20-Poly1305 with account/item/version binding, user-held 256-bit recovery secret, tombstone-aware restore logic.
- Privacy helpers: coordinate minimisation, log redaction, JPEG metadata stripping/verification.
- Public-fact rules: append-only fact store, partner/moderator/feed/intake rules, verification badges, subscription-independent ranking.
- Report intake: strict schema, rate limit, duplicates, PII flagging, moderated approval that drops contributor identity.
- Route adapter contract with timeout/quota/validation failure states (no concrete provider).
- PostgreSQL schema with RLS and append-only triggers.
- Expo client: plan, needs, report, privacy screens; secure key storage wrapper; fail-closed random source; one-shot coarse location; photo sanitising pipeline.
- Documents: SPEC, DATA_FLOWS, THREAT_MODEL, PERMISSIONS, PRIVACY_REGISTER, RETENTION, RISK_REGISTER, SECURITY_TESTS, DECISIONS, DEMO.

## Tested (automated, 67 tests)
All rows marked "Automated" in SECURITY_TESTS.md, plus one-off mutation checks showing key safeguards are actually covered, `npm audit` (core runtime deps clean; 22 findings in Expo/RN build tooling, 0 critical), TypeScript typecheck, Android and iOS Metro bundling, and Android/iOS native permission manifests via `expo prebuild`.

## Simulated
- Route provider, feeds, venues, moderator and partner actors are fakes/fixtures. Only one fictional venue exists (the target is 50 field-checked real destinations).
- Database tests use in-process PGlite, not a managed PostgreSQL service.

## Externally reviewed
Nothing. No independent cryptographic, privacy/security, accessibility or domain review has taken place.

## Blocked or not built
| Item | Why |
|---|---|
| Competitor and TfL/Expo/ICO source verification | Network policy blocked all those sites in the build environment (DECISIONS D-001) |
| Real route provider (TfL Unified API etc.) | Docs and licence unreadable (D-006) |
| Authentication, API server, moderator/partner portals, job queue, push | Not built; backend supplier/region/cost undecided (D-004) |
| Sharing, multi-device enrolment | No reviewed key-authentication design (D-005) |
| Device testing (secure random, secure store, photo re-encode, location prompts), real-device accessibility with disabled users | No device available |
| Field verification of 50 destinations; licensed data | Needs people on site and licence checks |
| DPIA, lawful-basis decisions, processor contracts, incident runbook, retention sign-off | Legal/organisational work (PRIVACY_REGISTER §7) |
| Pricing / payer validation | Needs customer research |
| Map view, entrance photos, scheduled pre-departure recheck, offline conflict handling | Not built |

## Next steps (recommended order)
1. Re-verify competitors and TfL/route-provider docs and licences from an unrestricted machine (Phase 0).
2. Run the app on real iOS/Android devices; close T-12, T-13, T-18, T-28, T-31.
3. Decide backend supplier and region; build auth + API enforcing PERMISSIONS.md; add T-21 tests.
4. Independent cryptography/privacy review before any real-data pilot.
