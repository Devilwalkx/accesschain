# AccessChain – Status report

## Android quality pass (2026-10-17, build 0.2.0). Full detail: docs/ANDROID_PASS_REPORT.md
- **Identity:** application id `app.devilwalkx.accesschain` (one-time uninstall of older test builds), version 0.2.0, build number from the CI run, commit and build time in Settings > About this build.
- **Journey shown as four parts** (Transport, Transfers, Final approach, Correct entrance), each with what is known, what is missing, how old it is and what to do next. Next steps use only data that is present (an OpenStreetMap page link, a phone/website OpenStreetMap itself lists, another route in the same result, or "check again"). **No map is built.**
- **Services audited** against their current published terms (docs/SERVICE_TERMS_AUDIT.md). Changes: no use of the OSM editing API; Nominatim limited to 1 request/second with caching; TfL Ordnance Survey attribution and non-endorsement line added. **Open:** Nominatim needs a proxy to meet its "switch without an app update" rule; the TfL live licence page could not be read (archived copy used); TfL branding guidelines unread.
- **Honest states:** live vs demonstration labelled on every screen; per-service "what answered" with ages; partial failures; slow/offline; retry cannot duplicate requests; results older than 15 minutes stop counting.
- **Fixed:** `busy` could stick if planning threw (now tested); the "recovery code" could not restore anything and was removed (the app says answers cannot be restored); the account id was a fixed string (now random per install, older data still opens).
- **Not run:** usability sessions with older or disabled people (plan in docs/USABILITY_SESSION_PLAN.md), TalkBack, any physical device. Emulator results are in the report and are not physical-device results.


## Real data (latest)
- **Real now:** TfL step-free journey planning (routes, walking distances, lifts and stairs on the route, turn-by-turn steps), TfL's list of broken lifts, and OpenStreetMap place notes for 10 South Bank venues (looked up live, shown with their age and author type).
- **Not real / not claimed:** nothing has been field-checked by us; the pavement between a station and a venue is never evidenced (so results are usually "We can't be sure yet" with a plain checked / not-checked list); venue notes are community-written and often undated or old; only 5 start stations and 10 venues.
- **Checked against reality:** adapters were written from responses recorded on GitHub's servers on 2026-10-17 (the sandbox cannot reach these sites). Unit/e2e tests use those recordings (one fixture is assembled from observed shapes and is labelled). A CI job (`live-smoke`) calls the real services from a browser; it is informational.
- **Unverified:** TfL's current live licence page (read from an archived copy), TfL branding guidelines, anonymous rate limits. Nominatim, OSM API and OSM attribution policies were read on 2026-10-17 (see the audit).
- **Privacy changed:** live mode contacts TfL and OpenStreetMap (they see the IP address and the request). A consent screen precedes the first request; the needs profile is never sent.


## Senior-friendly redesign (after real-phone feedback)
Second real-phone feedback: buttons usable but some text overlapped buttons. Redesign for older users: no bottom tab bar; Home screen with big buttons and a ‹ Back to home button everywhere; in-app Text size (Normal/Large/Extra large) that also respects Android's font size; answers in plain words with a symbol (✔ / ✖ / ?), reasons behind "Why?"; demo controls behind "Demonstration options"; confirmation before deleting; soft rounded design. New generic layout audit in the browser tests (text clipped inside buttons, overlapping buttons, text under buttons, sideways scroll) runs on every screen at normal and 2x text, and fails if a fixed height is reintroduced (verified). The audit also exposed missing `aria-checked` state on switches, now fixed. **Not yet re-verified on the phone.**

## First real-phone result (Android) and fix
The user installed the APK on a real Android phone: it installed and ran, but the status bar covered the top of the screen and the system navigation buttons covered the tab bar, making the app unusable. Cause: Android draws apps edge-to-edge and React Native's built-in `SafeAreaView` does nothing on Android. Fix: `react-native-safe-area-context` with real system insets; guarded by a browser test using simulated insets (verified to fail without the fix). **Not yet re-verified on the phone.**

## Phone delivery update
- **CI (GitHub Actions, run 2 on commit 94bb3fd): passed.** Typecheck, 67 unit/database tests, web build, 36 browser tests (before the HTTPS guard was added) and the Android release build all succeeded on GitHub's runners. Artifacts produced: `accesschain-android-test-apk` (28 MB, debug-signed, testing only) and `accesschain-web`. Locally the browser suite is now 51 tests; the commit adding the last 3 is pushed after this note and is covered by the next CI run.
- **Never run on a physical phone.** The APK builds but nobody has installed or launched it yet; native modules (secure store, secure random, image picker, location) are unproven on a device. iPhone: web version only; no installable iOS build.
- **Simplified usage:** plain-English `GETTING_STARTED.md`; first-run "Start here" card, quick-start presets and one-step "Save and see journeys" in the app; every push to `main` republishes a single always-newest GitHub Release with a plain `.apk`.
- **Test fix:** CI run 4 failed because one of my vault tests asserted random ciphertext did not contain the text "150", which random hex can contain by chance. Replaced with a collision-proof check and run 40 times without failure.
- Details: README "Run it on a phone", DECISIONS D-015 to D-017, SECURITY_TESTS T-35/T-36.


Generated at the end of build stage 1–3 (design, vertical slice, negative tests). Synthetic data only.

## Implemented
- Domain logic: evidence resolution with source/observed/retrieved/expiry, conflict handling, deterministic three-state matching (steps, lift, width, walking distance, rest gaps, toilet, assistance), journey completeness, evidence-backed alternatives, saved itinerary snapshots with live-change diff, screen-reader-first text itinerary.
- Private vault: XChaCha20-Poly1305 with account/item/version binding, key-wrapping functions for a future recovery design (not used by the app; the app offers no recovery), tombstone-aware restore logic.
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
