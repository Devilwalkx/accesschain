# AccessChain – Decisions (ADR log, DRAFT)

## D-001 Competitor and reference sources could not be checked
Sociability, AccessNow, TfL (specification PDF and Unified API page) and Expo docs all returned a proxy 403 from the build environment; only the npm registry was reachable. **Consequence:** no competitor claim, TfL data format, licence, Expo behaviour or ICO guidance was verified in this session. Everything that depends on them is marked open. *Action:* re-check from an unrestricted machine before Phase 0 conclusions.

## D-002 Monorepo: TypeScript core + Expo client + SQL schema
`packages/core` holds all decision logic (evidence, matching, vault, privacy, facts, reports) as pure TypeScript so it is unit-testable and shared by the phone client and any later server. `apps/mobile` is Expo/React Native (SDK 58, React 19.3, RN 0.88, versions taken from the installed `expo` package's bundled-module list). `packages/db` tests `db/schema.sql` against an in-process PostgreSQL (PGlite). Expo Go compatibility of `expo-secure-store`, `expo-image-manipulator`, `expo-crypto` etc. is **not verified**; a development build is likely needed.

## D-003 Cryptography
XChaCha20-Poly1305 (192-bit random nonces, safe for per-item random nonces) and HKDF-SHA256 from `@noble/ciphers` / `@noble/hashes` (audited, pure JS, no native module needed). The plan mentions AES-256-GCM "such as"; XChaCha was chosen to avoid nonce-reuse limits and native dependencies. No custom primitives. The **composition** (AAD binding, recovery wrapping) is ours and needs independent review (RISK S1). Biometrics only gate local key use in future; they never derive keys. Recovery uses a 256-bit user-held secret, so HKDF (not a password KDF) is appropriate; a user-chosen passphrase would require a memory-hard KDF and a new decision.

## D-004 Proposed backend (not built)
Proposal: managed PostgreSQL with row-level security, managed authentication with passkeys/MFA, private object storage, and a durable job queue, all in a UK (London) region where available. **Candidate suppliers, regions, subprocessors and operating costs have not been verified or quoted** (no network access to pricing or terms). Cost table: *to be completed*. Region is a preference, not proof of no overseas transfer: support access and subprocessors must be assessed (PRIVACY_REGISTER §5). `db/schema.sql` is supplier-neutral PostgreSQL.

## D-005 No sharing or multi-device key exchange in MVP
Encrypted sharing and new-device enrolment require authenticated recipient/device keys so the server cannot substitute keys. No defensible, reviewed design exists in this build, so it is **not built** and the UI does not offer it. Backup/restore relies on the recovery secret instead.

## D-006 (superseded by D-019) No route provider implemented
`core/routes.ts` defines the adapter contract, minimised coordinates, timeout, schema validation and failure states. A real adapter (TfL Unified API or other) must be written from the provider's actual documentation and licence, which could not be read (D-001). Fixtures are labelled synthetic and the UI shows a synthetic banner.

## D-007 Output is three states, no score
`known_fit | known_barrier | insufficient_evidence`. Missing, expired, conflicting or unmodelled evidence can never yield fit. A "probability" or percentage would imply precision we do not have.

## D-008 Conflicts are not auto-resolved
Fresh evidence that disagrees yields a conflict; if the disagreement decides the requirement, the result is insufficient evidence. A moderator dispute link forces conflict even when values match. No source is "always right".

## D-009 Append-only public facts
Observations are immutable; status and dispute links change with history. Enforced in code and in PostgreSQL triggers. Partners may withdraw only their own statements.

## D-010 Metro resolver for `.js` specifiers
Core uses NodeNext-style `./x.js` imports for TypeScript sources. `apps/mobile/metro.config.js` maps them to the extensionless module so Metro resolves the `.ts` files. Verified by Android and iOS bundling, not on a device.

## D-011 Photos
Primary control is on-device re-encode (drops metadata); a second control strips and re-verifies the bytes with `core/privacy.ts`; failure rejects the photo. Faces/bystanders are handled by user warning and moderation only. No face recognition or detection is used.

## D-012 Location
Manual origin supported; optional one-shot coarse foreground location; Android build config blocks background and fine location; coordinates rounded to ~100 m before any third-party call. Verified by running `expo prebuild`: Android requests only `ACCESS_COARSE_LOCATION` and `INTERNET` (plus a dev-tooling `SYSTEM_ALERT_WINDOW`/`VIBRATE` default to review for release); iOS declares only when-in-use location and the photo-library description. Disclosed as not private from the route provider.

## D-013 Accessibility approach
Text-first itinerary is the primary view; the map is a future addition. Meaning always carried by text (never colour alone), 48-pt targets, roles/labels/hints, live regions. **Unverified until tested with screen-reader users on real devices.**

## D-014 What this repo does not decide
Lawful bases, controller/processor roles, retention periods, supplier terms, DPIA outcome, product claims wording and pricing are **open** and listed in PRIVACY_REGISTER §7. Pricing for institutional payers is untested and nothing in this build assumes a price.

## D-015 Phone delivery: Android APK and web/PWA, no service worker
The app is one Expo codebase for Android, iOS and web. Delivered to phones via GitHub Actions: a debug-signed Android release APK (testing only) and a static web build installable as a PWA. iOS has no installable artifact without an Apple Developer account, signing and (for TestFlight) App Store Connect; the web build is the iPhone route for now. **No service worker**: offline caching of access information needs an explicit staleness policy first, otherwise a cached "all clear" could outlive its evidence.

## D-016 Web key protection and HTTPS requirement
Browsers have no Keychain/Keystore. The web client keeps the content key in IndexedDB wrapped by a non-extractable WebCrypto AES-GCM key. This resists copying storage contents, not malicious script in the page or a compromised browser profile, and clearing site data permanently destroys the key (the recovery secret is the backup). WebCrypto exists only in secure contexts, so the app refuses to start on plain HTTP with a clear message and stores nothing. `navigator.storage.persist()` is requested to reduce eviction; browsers may refuse.

## D-017 Ciphertext in localStorage on web
Only ciphertext envelopes and non-secrets go in `localStorage`; keys never do. An e2e test fails if plaintext profile fields appear there (and was verified to fail when one was deliberately leaked).

## D-018 Senior-friendly interface (AccessChain only)
AccessChain is intended for older people as well as everyone else, so: one level of navigation (Home + Back), no tab bar; large type and generous targets; in-app text size plus honouring the system font size; plain words ("Does not suit your needs", "We can't be sure yet") with a symbol and colour, never colour alone; detail behind "Why?"; confirmation for destructive actions; no jargon on the main path. The honest three-state result is unchanged (unknown is never a pass); only the wording changed. Accessibility is validated by axe and a layout audit in a desktop browser; real testing with older users and screen-reader users has not happened and is still required.

## D-019 Live data sources (TfL, OpenStreetMap), verified by probing from CI
The build sandbox cannot reach these sites, so adapters were written against responses recorded by a read-only workflow (`probe.yml`) on GitHub's runners on 2026-10-17. Used: TfL `Journey/JourneyResults` with `accessibilityPreference=StepFreeToVehicle,StepFreeToPlatform`; TfL `Disruptions/Lifts/v2`; OpenStreetMap Nominatim search with `extratags=1`; OSM API for last-edit date. Not used: Overpass (slow and unreliable in the probe), TfL StopPoint accessibility fields (inconsistent between stations). All responses are validated with zod; anything unexpected is dropped and becomes "insufficient evidence". Recorded fixtures live in `packages/core/test/fixtures` (one is explicitly *assembled* from observed field shapes, not a single verbatim response).

## D-020 What the live data can and cannot prove
- TfL's planner returning a step-free journey is recorded as TfL's statement about **transport legs**, valid 15 minutes. It says nothing about kerbs, crossings or pavement, so **walking legs never get a "step-free" observation**; the pavement stays unknown. Consequence: for people who must avoid steps, real results are usually "We can't be sure yet", with a plain list of what was and wasn't checked. They never reach "Suits your needs" unless the pavement is evidenced (not possible from these sources).
- The TfL lift feed lists only **broken** lifts. "No problem reported" is the strongest statement available, and is worded that way. If the feed cannot be loaded, lifts are unchecked, not fine.
- Walking distance and stairs/lift obstacles in TfL's route are real and can produce a certain "known barrier".
- "No journey found" (HTTP 404) means TfL has no step-free journey: shown as such.

## D-021 Community (OpenStreetMap) information policy
Tags `wheelchair=yes|no` count as evidence only with a **date**: `check_date:wheelchair`/`check_date` if present, else the object's last-edit time, and only if under two years old (730 days, an unvalidated policy choice). `limited` and missing tags give no evidence (shown in words). The OSM API that gives edit dates is blocked for browsers (no CORS), so the **web build treats undated notes as unknown**; the Android app can read dates. Notes are always shown with their age and the words "written by OpenStreetMap contributors". OSM data is fetched live and never bundled or redistributed (ODbL attribution displayed).

## D-022 Privacy of live requests
Requests carry only: a start station id or a location rounded to ~100 m, the venue's public coordinates, and the venue name. The needs profile never leaves the device (test asserts no request contains profile fields). TfL and OpenStreetMap services can see the device's IP address and request time; this is disclosed on a consent screen before the first request and in Privacy. The choice (live/demo) is stored as a non-secret setting. Venue lookups are cached in memory for 10 minutes to respect Nominatim's usage policy.

## D-023 Licences and terms: NOT verified
TfL's terms pages returned 403 to automated fetching; the TfL API portal text mentions application keys but was not read in full. Attribution ("Powered by TfL Open Data", "© OpenStreetMap contributors", ODbL) is displayed, but **the TfL open data licence and fair-use limits, and Nominatim's usage policy for apps, must be checked by a person before any wider use**. No TfL app key is bundled; anonymous rate limits apply.
