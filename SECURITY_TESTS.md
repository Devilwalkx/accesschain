# AccessChain – Security and negative tests (DRAFT)

Reference standard: OWASP MASVS for the mobile client and a suitable backend verification standard. Passing this list is **not** a certification. Each row says what actually ran.

Browser tests run with `npm run e2e` (39 tests). Legend: **Automated** = runs in `npm test` (67 tests: 60 in `packages/core`, 7 in `packages/db`); **Not run** = needs a real device, service or reviewer; **Not built** = the feature does not exist yet.

Mutation checks were also run once: deliberately breaking expiry handling, unknown-handling, AAD binding, partner withdrawal rules and the RLS policy each made tests fail (so those tests do detect regressions). This is a one-off manual check, not a CI job.

| ID | Test | File | Status |
|---|---|---|---|
| T-01 | Private-items table has no plaintext columns; non-AEAD envelopes rejected | `db/test/schema.test.ts` | Automated |
| T-02 | Sealed envelope contains no plaintext | `core/test/vault.test.ts` | Automated |
| T-03 | Ciphertext bound to account/item/version (swap, cross-account, rollback fail) | vault.test.ts | Automated |
| T-04 | Wrong key, tampered ciphertext/nonce, unsupported envelope throw | vault.test.ts | Automated |
| T-05 | 2000 encryptions yield 2000 distinct nonces | vault.test.ts | Automated |
| T-06 | Without key or recovery material nothing decrypts (password-reset equivalent) | vault.test.ts | Automated |
| T-07 | Recovery secret round-trip, tolerant input, wrong length/char/account rejected | vault.test.ts | Automated |
| T-08 | Expired evidence is unknown; clocks-forward (UTC vs BST offsets) compared as instants | `core/test/match.test.ts` | Automated |
| T-09 | Lift failure after planning surfaces against saved itinerary; stale live feed ⇒ insufficient | match.test.ts, itinerary.test.ts, demo.test.ts | Automated |
| T-10 | Contradictory reports; decisive vs non-decisive numeric disagreement; moderator disputes | match.test.ts, facts.test.ts | Automated |
| T-11 | Missing kerb/width/step info, missing entrance, malformed or future timestamps, unlicensed feed never pass; no score fields | match.test.ts | Automated |
| T-12 | Secure RNG on real iOS/Android (Hermes) with expo-crypto | – | **Not run** |
| T-13 | Photo metadata: unit-tested stripping of EXIF/GPS/XMP/IPTC/comments, malformed JPEG rejected. On-device re-encode behaviour | `core/test/privacy.test.ts`; device | Unit automated; **device not run** |
| T-14 | Partner cannot impersonate feed/other source, withdraw/dispute community reports, or edit values | facts.test.ts | Automated |
| T-15 | DB: values immutable, deletes blocked, history append-only, constraints (licence, verifier type, times, one value) | schema.test.ts | Automated |
| T-16 | Hostile/malformed reports: extra fields, bad enum, NaN, 1e9, oversize note, future time, non-object, rate limit, duplicates | `core/test/reports.test.ts` | Automated |
| T-17 | PII flagging (email, phone, postcode, home, health references); approval refuses unredacted notes; pseudonym dropped | reports.test.ts | Automated (heuristic, not exhaustive) |
| T-18 | Coordinate rounding; invalid coordinates; foreground-only location config | privacy.test.ts; `app.json` | Rounding automated; **permission behaviour not run** |
| T-19 | Route provider timeout, quota, error, malformed or empty response, invalid origin ⇒ visible unavailable | `core/test/routes.test.ts` | Automated against fakes only |
| T-20 | RLS: another account cannot read or write; no account context ⇒ nothing visible | schema.test.ts | Automated (PGlite, non-superuser role) |
| T-21 | Cross-tenant/object access through the real API (endpoints, files, jobs, websockets, exports) | – | **Not built** |
| T-22 | Deleted items do not reappear after restore; other accounts' backup entries never restored | vault.test.ts | Automated (logic only; real backup restore **not run**) |
| T-23 | Ranking identical regardless of subscription/sponsored fields | facts.test.ts | Automated |
| T-24 | Log redaction of coordinates, postcodes, profile and origin keys | privacy.test.ts | Automated (crash-reporting integration **not built**) |
| T-25 | Verification badge validity, lapse, self-report labelling | facts.test.ts | Automated |
| T-26 | Dependency review | `npm audit` | Run once: core runtime deps 0 findings; 22 findings (15 high, 7 moderate, 0 critical) in Expo/React Native build tooling (metro, node-forge, braces, uuid…). No SBOM, signing or secret scanning yet |
| T-27 | Encrypted-traffic inspection proving no plaintext private content on the wire | – | **Not run** (this build sends nothing) |
| T-28 | Real-device accessibility: screen readers (TalkBack/VoiceOver), large text, switch access, disabled-user testers. (Automated axe scan exists, see T-35; it finds only a minority of real accessibility problems) | – | **Not run** |
| T-29 | Offline conflicts and pending actions | – | **Not built** |
| T-30 | Restore/delete drill, backup expiry | – | **Not run** |
| T-31 | Key loss/recovery on real devices; new-device enrolment | – | **Not run / not built** |
| T-32 | Malicious partner edits at the API/UI level, moderator workflow | – | **Not built** (rules tested at library and DB level) |
| T-35 | Browser build on three phone viewports (Pixel 7 emulation, 390 px, 320 px): end-to-end verdicts incl. stale lift; profile encrypted at rest (no plaintext keys in localStorage, verified to fail when plaintext is deliberately leaked); lost key fails closed; recovery secret format; erase; report PII hold; zero third-party network requests; no horizontal overflow; touch targets ≥ 44 px; tab labels do not wrap; keyboard operation; axe WCAG 2 A/AA scan on every screen; PWA manifest/icons served; no service worker; refuses to run without WebCrypto | `e2e/tests/app.spec.ts` (13 tests × 3 viewports = 39) | Automated in headless Chromium only. **Not Safari/Firefox, not real phones, not screen readers** |
| T-36 | Android release APK builds and requested permissions contain no forbidden entries | `.github/workflows/build.yml` | Runs in GitHub Actions; see STATUS.md for the latest result |
| T-33 | Independent cryptographic and privacy/security review, penetration test | – | **Not done** |
| T-34 | Native permission manifests: `expo prebuild` run for Android and iOS; Android requests only coarse location + internet (background/fine/mic/camera/storage removed), iOS only when-in-use location, photo-library description. `app.json` asserted in `core/test/appconfig.test.ts`. Release-build permissions (e.g. `SYSTEM_ALERT_WINDOW`, a dev-tooling default still present) not reviewed | `core/test/appconfig.test.ts` | Config automated; release build **not reviewed** |

## How to run

```bash
npm install
npm test            # 67 automated tests
npm run typecheck   # core and mobile
npm run demo        # regenerates docs/DEMO.md
```

Mobile bundling (`npx expo export --platform android|ios` in `apps/mobile`) succeeded in this environment; the app has **never been run on a device or simulator**.
