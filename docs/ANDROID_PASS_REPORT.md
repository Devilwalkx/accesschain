# AccessChain: Android product-quality pass report

Date: 2026-10-17. Repo `Devilwalkx/accesschain`, branch `claude/h-gm8m50` and `main`. Build under test: version 0.2.0, application id `app.devilwalkx.accesschain`, commit @@COMMIT@@, CI run @@RUN@@ (version code = run number). **No physical device was used. TalkBack was not run. No older or disabled person has used the app.** Every "Android" fact below comes from GitHub Actions emulators (API 36 Pixel 6 profile, API 29 Pixel 5 profile) and says so.

Status words: PASS = checked by a test or measurement named here; PARTIAL; FAIL; NOT TESTED; BLOCKED.

## 1. State table

| Area | State | Evidence |
|---|---|---|
| Native React Native screens: Home, Plan (live and demonstration), Needs, Report, Privacy, Settings | Working (browser and emulator) | `apps/mobile/src/screens/*`, `e2e/tests/*`, `android-tests/flows/*` |
| Live TfL step-free journeys and lift list; OpenStreetMap place notes | Working against the real services from a GitHub runner browser (live-smoke) and from the Android 36 emulator app (the "What answered" card showed all three services answered "just now" in the CI run 25 evidence) | `e2e/tests/live.real.spec.ts`; `emulator-evidence-api36-pixel6-standard/live-result-text.txt` on branch `evidence/run-25` |
| Demonstration mode | Working, labelled on every screen | `e2e/tests/app.spec.ts` |
| Journey as four parts with known / missing / age / next step | Working | `packages/core/src/live/brief.ts`, `packages/core/test/brief.test.ts` |
| Map | **Not built** (the text itinerary is the primary and only view) | none |
| Manual start: station list, UK postcode (to TfL), "where I am now" with refusal handling | Working (browser); location refusal on Android: see section 5 | `e2e/tests/live.spec.ts` |
| Recovery of answers after losing the phone | **Not possible, and the app says so** (the old "recovery code" could not restore anything and was removed) | DECISIONS D-026, `e2e/tests/app.spec.ts` |
| Reports ("Tell us about a problem") | **Simulated / incomplete**: only checks a report on the phone; the screen says "Not built yet: reports cannot be sent" | `apps/mobile/src/screens/Report.tsx` |
| Sharing, accounts, server, notifications | Not built | n/a |
| Service terms audit | Done for Nominatim, OSM API, OSM tiles (not used), OSM attribution, TfL licence (read from an archived copy because the live page returned a bot-check 403) | `docs/SERVICE_TERMS_AUDIT.md` |
| Usability sessions | **NOT RUN** | `docs/USABILITY_SESSION_PLAN.md` |
| TalkBack / screen reader on a device | **NOT TESTED** (browser axe only) | n/a |
| Physical device | **NOT TESTED** | n/a |

## 2. Architecture facts

- Framework: Expo 58 / React Native 0.88 (new architecture default), TypeScript. Native screens, **no WebView**. Web build (react-native-web) is used for browser tests and a zip on the release page.
- Domain logic: `packages/core` (evidence resolution, deterministic matching with three outcomes, live adapters for TfL and OpenStreetMap, journey brief). Unit-tested with Vitest.
- Storage: needs profile encrypted with XChaCha20-Poly1305 (AAD binds account id, item and version); ciphertext in `expo-secure-store` on Android; the content key in the same secure store (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Text size, colours and the live/demo choice are non-secret settings. Nothing else is stored. Android cloud backup is off (`allowBackup=false`, checked in the generated manifest).
- Account id: random per install (`ac.account`), legacy fixed id kept only to open data from older builds. Deleted with "Delete my answers".
- Recovery: none (see 8). Deletion removes the ciphertext, the key and the install id.
- Permissions requested (from `dumpsys package` on the emulator, in the evidence): `INTERNET`, `ACCESS_COARSE_LOCATION` only (the evidence of the earlier run 25 also listed `USE_BIOMETRIC` and `USE_FINGERPRINT` from the secure-store library; they are blocked from the next build and CI fails if they, or others, reappear).
- External services: TfL Unified API (`api.tfl.gov.uk`: journey results, lift disruptions), OpenStreetMap Nominatim (place by fixed name). The OSM editing API is no longer called. No analytics, no map tiles, no server of ours.
- Source paths: `apps/mobile/App.tsx`, `apps/mobile/src/{store,nav,ui,live,location,profileRepo,accountId,tripRunner}.ts(x)`, `apps/mobile/src/design/*`, `apps/mobile/src/screens/*`, `packages/core/src/live/{client,tfl,osm,brief,places}.ts`.
- Signing: the APK is signed with the public Android debug key (test signing). A private release key is an open owner decision.

## 3. Changes and why

1. **Identity.** Unique id `app.devilwalkx.accesschain`, version 0.2.0, version code from the CI run, commit/build time injected by `app.config.js` and shown in Settings > About this build. Web page stamped with `<meta name="application-id">`; e2e port 4391, Metro 8391, `reuseExistingServer: false`, tests assert the meta tag and the ports. `allowBackup=false`, predictive back on. Unused permissions blocked and CI fails on them.
2. **Design foundation** ported from ScopeLock with AccessChain's own palette and stricter numbers for older readers: body 18 sp, nothing under 16 sp, 56 dp targets, text contrast at least 7:1 in light and dark (unit test), icon plus words for every status, reduced motion honoured, Android font scale never disabled, light/dark/system theme, in-app text size on top of the system size. Headlines stop growing at 130%/160% of the system size so a word cannot split (found on the 200% emulator).
3. **Screens around a decision** (`docs/SCREEN_DECISIONS.md`): one labelled Back button on every screen but Home, system Back unwinds result, start, place, Home; no role switcher; the demonstration is a labelled mode, not mixed with personal data.
4. **Journey in four parts** (R1, R2, R3): the result leads with the place, the person's needs as labels, the route title and one sentence; then Transport, Transfers, Final approach, Correct entrance, each with what is known, what is missing, how old, and what to do next. Next steps come only from data present (OpenStreetMap page link; a phone number or website OpenStreetMap lists, shown as "not checked by us"; another route in the same result; check again). A walking distance never proves step-free access; no pavement, crossing, phone number or route is invented. A bug found on the emulator (internal source ids such as `synthetic-field-check-1` shown to the reader) was fixed and has a test.
5. **Service audit** (R5): see `docs/SERVICE_TERMS_AUDIT.md`. Code changes: no OSM editing API; Nominatim at most 1 request per 1.1 s, cached 30 min (10 min for "no match"), identical simultaneous requests merged; native User-Agent names the application id, version and project URL; TfL Ordnance Survey attribution and a non-endorsement line added; tappable OpenStreetMap licence link; typed start limited to a UK postcode sent to TfL only (a probe showed TfL silently matches nonsense text to a real place).
6. **Honest states** (R6): live vs demonstration labelled on every screen; "What answered" card per service with its age; partial failures (OpenStreetMap down, TfL down, lift list down, slow) shown per service; offline wording; evidence older than 15 minutes stops counting and says so; "Check again" is disabled while running and identical requests are merged, so a retry cannot duplicate requests.
7. **Recovery and `busy`** (R7): the recovery code screen was removed and the app says the answers cannot be restored; `busy` sticking is fixed with `TripRunner` (also ignores late answers) and unit-tested including the regression.
8. **Android tests and evidence**: Maestro flows, `android-tests/run.sh`, emulator and evidence-publishing jobs in `.github/workflows/build.yml`.

## 4. Main journey (exact steps)

1. Install `AccessChain-test.apk` (one-time uninstall of any older build: new application id). Open it.
2. Home: tap "Tell us what you need". Tap what applies (default: "I can't manage steps", "Lifts are fine"). Optional numbers behind "Walking and doorway details". "Save and see my routes".
3. "Use live information?": choose "Yes, use live information" (TfL and OpenStreetMap are contacted) or "No, use the demonstration instead" (made-up places, nothing leaves the phone). **Manual step: this choice. Missing-service step: with no internet the live choice shows per-service "no answer" notices.**
4. Live: choose one of 10 South Bank places, then a start: one of 5 stations, or type a UK postcode, or "Where I am now" (the screen explains first; the phone then asks; refusing is handled).
5. Result: place, needs labels, route title and one sentence, then the four parts; "Turn-by-turn directions from TfL"; "Read this route as plain text"; "What answered"; "Check again".
6. Demonstration: same layout with made-up data; "Demonstration options" lets you pretend 45 minutes passed to see evidence expire.

## 5. Android verification facts (emulator only)

CI run @@RUN@@ (commit @@COMMIT@@). Job results: @@JOBS@@

| Item | API 36, Pixel 6 profile, font 1.0, light | API 29, Pixel 5 profile, font 2.0 (200%) |
|---|---|---|
| Install | @@INSTALL36@@ | @@INSTALL29@@ |
| Required flows (first run, main task, system Back, keyboard, settings/about, kill and relaunch) | @@FLOWS36@@ | @@FLOWS29@@ |
| Informational flows (live journey with real services, location refusal, offline) | @@INFO36@@ | @@INFO29@@ |
| Cold start (5 runs, `am start -W` TotalTime) | @@START36@@ | @@START29@@ |
| Memory | @@MEM36@@ | @@MEM29@@ |
| Scroll jank (`gfxinfo` while scrolling the longest screen) | @@JANK36@@ | @@JANK29@@ |

- **Upgrade from the previous APK:** @@UPGRADE@@
- **Back / predictive back:** the Back flow (journey result to start to place to Home to leaving the app) is a required flow; see the table. Predictive back is enabled in the manifest (`enableOnBackInvokedCallback="true"`, CI check). The predictive back *animation* was not observed.
- **Keyboard:** flow `05-keyboard-needs` opens the keyboard on a number field, then reaches and taps "Save and see my routes".
- **Permissions:** the emulator manifest lists only `INTERNET` and `ACCESS_COARSE_LOCATION`. Location refusal flow: @@LOC@@
- **Background/relaunch/process death:** flows `08` and `09` save needs, choose demonstration, press Home, kill the process with `am kill`, relaunch and find the needs and the mode again. Result in the table. A full rotation screenshot is in the evidence (`20-landscape.png`); no rotation behaviour is claimed beyond that it renders.
- **Offline:** the live flow was run with airplane mode on; result @@OFFLINE@@.
- **Notifications:** none exist.
- **Dark theme on Android:** the emulator did not switch to night mode through `adb` (screenshots on API 29 are light although night was requested), so dark mode is **verified in the browser only**.
- Emulator limits: software rendering (swiftshader), so jank and timings are not representative of a phone; the emulator has no real GPS and the live results depend on the day's real TfL and OpenStreetMap data (recorded, never asserted).
- **Physical device: NOT TESTED.**

## 6. Visual and accessibility evidence

- Before/after screenshots at Pixel 7 and 320x568, light and dark, 200% text: `docs/evidence/before/` (commit 8907428, built in a git worktree) and `docs/evidence/after/` (browser, real fixtures through mocked network). Flows: first run, home with needs, choose start, live result (top and parts), demonstration result.
- Emulator screenshots and recordings: branch `evidence/run-@@RUN@@` (`main-task.mp4`, `shots/*`, `maestro/*/` screenshots, `hierarchy/*.xml`).
- Contrast: unit-tested (7:1 for text in both themes; `apps/mobile/src/design/tokens.test.ts`). Touch targets: 56 px checked by `auditLayout` on every screen at three phone sizes, normal and 200% text. axe (WCAG 2 A/AA) passes on every screen in light, 200% text and dark in the browser. These are automated checks and find only part of the real problems.
- Combination limit: the in-app Extra large (1.4x) on top of a 200% system size (2.8x) is **not guaranteed** to fit; 200% alone and 1.4x plus 140% are tested.
- **TalkBack: NOT TESTED.** Labels, roles and live regions are set (and checked by axe in the browser), but nobody listened to the app with a screen reader.
- Defects found by looking at emulator screenshots and fixed: an internal source id shown to the reader; the headline "AccessChain" breaking mid-word at 200%; screens that kept the previous scroll position after navigation.

## 7. Test evidence

Commands: `npm run typecheck`; `npm test` (core, db, mobile unit tests); `npm run build:web -w @accesschain/mobile`; `npm test -w @accesschain/e2e` (Playwright, 3 viewports); CI emulator job.

- Core and database tests: @@UNIT@@. Mobile unit tests: design tokens (contrast both themes, sizes), account id, `TripRunner` (incl. `busy` regression, stale answers). New core tests: journey brief (four parts, no step-free claim from distance, contact next steps only when present, comparison only inside one result, source ids hidden), client (per-service failure, slow vs offline, merged duplicate requests, retry, 1 request per second, cached "no match", `planTrip` never throws, postcode to TfL only), app config (id, version, permissions, ports, meta tag).
- Browser tests: @@E2E@@ (three projects: Pixel 7, 390 px, 320 px). Includes lost-key fail-closed, encrypted storage, no network before consent, privacy of requests (no needs, rounded location, no OSM editing API), layout audit at normal/200%, axe in light/200%/dark, system bars, Back behaviour.
- Failures met and fixed: layout text spilling in a 13-letter word at 320 px / 200% (word wrap), text scrolled under the app bar counted as overlap (audit clipped), faded animation read by axe as low contrast (tests use reduced motion), a Back test that assumed saved needs, emulator flows that assumed content was above the fold at 200% text and scrolled too far per step.
- Negative tests: lifts unavailable is not "fine"; undated or old notes are not evidence; garbage responses; 404, 300, offline, timeout; personal details in a report note are held back.
- **What the tests do NOT establish:** that any real place is accessible; that the pavement is step-free (nobody publishes it); behaviour on a physical phone; TalkBack behaviour; that real older users understand the wording; the long-term behaviour of TfL and OpenStreetMap (the live smoke job is informational); that the User-Agent is actually sent by the Android HTTP stack (not observed).

## 8. Privacy and security

- Leaves the device (live mode only, after consent): to TfL the start (station id, location rounded to about 100 m, or a typed UK postcode) and the place's coordinates, plus the internet address; to OpenStreetMap a fixed place name, plus the internet address. **The needs profile is never sent** (tested).
- Who can read what: needs are readable only on the phone with the key; the key is in the phone's secure store, not backed up. TfL and OpenStreetMap can see the requests above.
- Recovery/revocation/deletion: no recovery (answers cannot be restored); deletion removes answers, key and install id from this phone; copies made elsewhere (screenshots, text copied from the plain-text view) are not affected.
- Verified vs intended: encryption at rest and key loss behaviour verified in the browser build only; the Android secure-store path ran on emulators (save, kill, relaunch) but was not reviewed by anyone. No independent cryptographic, privacy or accessibility review.
- Service terms: see audit. Open items: no proxy for Nominatim (policy requires being able to switch without an update), TfL anonymous use and branding guidelines, an LLM-related clause in the Nominatim policy that needs a deliberate owner decision.

## 9. Known issues

| # | Severity | Issue | Impact | Repro | Code | Proposed fix |
|---|---|---|---|---|---|---|
| 1 | High | Public Nominatim without a proxy: cannot be switched without an app update and all users share its 1 request/second | Could be blocked; policy breach at scale | n/a | `packages/core/src/live/client.ts` | Small proxy/cache, owner decision |
| 2 | High | The pavement and crossings are never evidenced, so real results are almost always "We can't be sure yet" | Useful for what to ask the venue, not for a go/no-go | any live result | by design | Field verification, licensed data |
| 3 | Medium | Community notes are often undated (edit dates are no longer read) | Entrance often "not confirmed" | Borough Market | `osm.ts` | A permitted read-only source of edit dates |
| 4 | Medium | In-app Extra large on top of a 200% system size can break very long words | Large-text users with both | 2.8x text | `ui.tsx` | Cap in-app size when system size is large |
| 5 | Medium | No TalkBack, physical device or usability testing | Unknown real-world problems | n/a | n/a | Run the plan |
| 6 | Medium | Emulator did not apply night mode; dark theme unverified on Android | Dark colours untested on a phone | API 29 run | `design/theme.tsx` | Check on a device |
| 7 | Low | Unsaved answers are lost if the app is killed (by design, nothing is written in the clear) | Re-type on the needs screen | kill during editing | `Needs.tsx` | Sealed drafts if wanted |
| 8 | Low | Reports are not sent anywhere | Feature incomplete (labelled) | Tell us about a problem | `Report.tsx` | Build the moderated intake |

## 10. Next actions

1. Owner: decide on the Nominatim proxy and TfL registration (cost: a small server; blocks wider use).
2. Owner: read TfL's live licence page and branding guidelines in a normal browser.
3. Run the usability sessions in `docs/USABILITY_SESSION_PLAN.md` with older and disabled participants (needs recruitment and consent; blocks any claim about understandability).
4. Run the app on a physical Android phone with TalkBack, large text and dark mode.
5. Field-check a few places (pavement and entrance) so "Final approach" can be evidenced.

## Requirements checklist

| ID | Requirement | Result |
|---|---|---|
| Shared 1 | Identity: id, version 0.2.0, version code, build info in About, ports, `application-id` test, blocked permissions, no backup, predictive back | PASS (CI checks and unit tests) |
| Shared 2 | Design foundation, contrast tested light and dark, 200% text, reduced motion, states | PASS in browser; PARTIAL on Android (dark not applied on the emulator; 2.8x combination not guaranteed) |
| Shared 3 | Screens around a decision, no persona switcher, demo labelled, incomplete features labelled | PASS (`docs/SCREEN_DECISIONS.md`) |
| Shared 4 | Android behaviour: back, keyboard, permission denial, relaunch, offline, upgrade | PARTIAL: see section 5 (emulator only; physical NOT TESTED) |
| Shared 5 | Evidence before/after, docs, report, usability plan | PASS for documents and screenshots; usability sessions NOT RUN |
| R1 | Lead with the journey and constraints | PASS (browser tests check the order); not tested with people |
| R2 | Transport, Transfers, Final approach, Correct entrance with known / missing / age | PASS |
| R3 | Useful next steps from available data; nothing invented | PASS (tests); not tested with people |
| R4 | Readable text itinerary; no fake map; manual origin; denied permission handled | PASS in browser; Android permission refusal: @@LOCSTATE@@ ; map not built |
| R5 | Service audit and app adjustments | PARTIAL: Nominatim, OSM API, OSM tiles/attribution read in full; TfL licence read from an archive copy; owner decisions open |
| R6 | Honest live/demo labels, ages, offline/slow/partial failure, retries | PASS (mocked network and one real-service run); slow network on a device NOT TESTED |
| R7 | Recovery gap honest; `busy` bug fixed with a test | PASS |
| R8 | Android flows (live informational, demo main), evidence, report | PARTIAL: @@R8@@ |
