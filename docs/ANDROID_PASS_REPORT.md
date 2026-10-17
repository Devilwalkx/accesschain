# AccessChain: Android product-quality pass report

Date: 2026-10-17. Repo `Devilwalkx/accesschain`, branches `claude/h-gm8m50` and `main`. Build under test: version 0.2.0, application id `app.devilwalkx.accesschain`, source commit `3056285fb9b71e1fa328a82a11ec3e816aea8da0`. CI run 49 (on `main`, produced the release) and run 48 (on the branch, same commit). **No physical device was used. TalkBack was not used for any usability result. No older or disabled person has used the app.** Every "Android" fact below comes from GitHub Actions emulators (API 36 Pixel 6 profile, API 29 Pixel 5 profile) and says so.

Status words: PASS = checked by a test or measurement named here; PARTIAL; FAIL; NOT TESTED; BLOCKED.

## 1. State table

| Area | State | Evidence |
|---|---|---|
| Native React Native screens: Home, Plan (live and demonstration), Needs, Report, Privacy, Settings | Working (browser and emulator) | `apps/mobile/src/screens/*`, `e2e/tests/*`, `android-tests/flows/*`; CI run 49 `test-and-web` |
| Live TfL step-free journeys, lift list and OpenStreetMap place notes | Working on the emulator (API 36, run 48): OpenStreetMap, TfL journey planner and TfL lift list all answered for Tate Modern. Answers depend on the day's real data. | `docs/evidence/emulator/api36-pixel6-live-result-top.png`, `api36-pixel6-live-what-answered.png`; run 48 `evidence/run-48` |
| Demonstration mode | Working, labelled on every screen ("Demonstration. The places and information are made up.") | `docs/evidence/emulator/api36-pixel6-main-task-correct-entrance.png` |
| Journey as four parts with known / missing / age / next step | Working on the emulator and in the browser | `docs/evidence/emulator/api36-pixel6-main-task-result-top.png` |
| Map | **Not built** (the text itinerary is the primary and only view) | none |
| Manual start: station list, UK postcode (to TfL), "Where I am now" with refusal handling | Working (browser); Android location refusal: see section 5 | `docs/evidence/emulator/api36-pixel6-location-denied.png` |
| Recovery of answers after losing the phone | **Not possible, and the app says so** | `docs/ENCRYPTION_ACCOUNT.md`, `e2e/tests/app.spec.ts` |
| Reports ("Tell us about a problem") | **Simulated / incomplete**: only checks a report on the phone; the screen says reports cannot be sent | `apps/mobile/src/screens/Report.tsx` |
| Sharing, accounts, server, notifications | Not built | n/a |
| Service terms audit | Done for Nominatim, OSM API, OSM tiles (not used), OSM attribution, TfL licence (read from an archived copy because the live page returned a bot-check 403) | `docs/SERVICE_TERMS_AUDIT.md` |
| On-phone encryption self-check | Passes on both emulators (flow 15) | `docs/evidence/emulator/api36-pixel6-encryption-check.png`; `emulator-evidence-api29-pixel5-text200-dark/log.txt` |
| Usability sessions | **NOT RUN** | `docs/USABILITY_SESSION_PLAN.md` |
| TalkBack / screen reader | **NOT TESTED** for usability. One non-gating TalkBack experiment ran on API 36 only (section 5). | `emulator-evidence-api36-pixel6-standard/talkback/` on `evidence/run-48` |
| Physical device | **NOT TESTED** | n/a |
| Upgrade from a previous APK | **NOT TESTED** (the application id is new, so no previous build of this id exists) | section 5 |

## 2. Architecture facts

- Framework: Expo 58 / React Native 0.88 (new architecture default), TypeScript. Native screens, **no WebView**. Web build (react-native-web) is used for browser tests and a zip on the release page.
- Domain logic: `packages/core` (evidence resolution, deterministic matching with three outcomes, live adapters for TfL and OpenStreetMap, journey brief). Unit-tested with Vitest.
- Storage: needs profile encrypted with XChaCha20-Poly1305 (AAD binds account id, item and version); ciphertext in `expo-secure-store` on Android; the content key in the same secure store (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Text size, colours and the live/demo choice are non-secret settings. Android cloud backup is off (`allowBackup=false`, checked in the generated manifest).
- Account id: random per install (`ac.account`), legacy fixed id kept only to open data from older builds. Deleted with "Delete my answers".
- Recovery: none (see 8). Deletion removes the ciphertext, the key and the install id.
- Permissions: the APK requests `INTERNET` and `ACCESS_COARSE_LOCATION` only (`package.txt` in run 48, both emulators). The custom `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` is the framework's own signature permission. CI fails if a forbidden permission reappears.
- External services: TfL Unified API (`api.tfl.gov.uk`: journey results, lift disruptions), OpenStreetMap Nominatim (place by fixed name). The OSM editing API is no longer called. No analytics, no map tiles, no server of ours.
- Source paths: `apps/mobile/App.tsx`, `apps/mobile/src/{store,nav,ui,live,location,profileRepo,accountId,tripRunner}.ts(x)`, `apps/mobile/src/design/*`, `apps/mobile/src/screens/*`, `packages/core/src/live/{client,tfl,osm,brief,places}.ts`.
- Signing: the release APK is signed with the public Android debug key (test signing). The private-key path is prepared (`docs/SIGNING.md`) but no key exists. Owner decision open.

## 3. Changes and why

1. **Identity.** Unique id `app.devilwalkx.accesschain`, version 0.2.0, version code from the CI run, commit/build time injected by `app.config.js` and shown in Settings > About this build (run 48 APK shows "Version 0.2.0 (build 48)", "Commit 3056285"). Web page stamped with `<meta name="application-id">`; e2e port 4391, Metro 8391, `reuseExistingServer: false`; tests assert the meta tag and the ports (`identity` test passes on all three browser projects). `allowBackup=false`, predictive back on. Unused permissions blocked and CI fails on them.
2. **Design foundation** ported from ScopeLock with AccessChain's own palette and stricter numbers for older readers: body 18 sp, nothing under 16 sp, 56 dp targets in the browser layout test, text contrast at least 7:1 in light and dark (unit test), icon plus words for every status, reduced motion honoured, Android font scale never disabled, light/dark/system theme, in-app text size on top of the system size. Headlines stop growing at 130%/160% of the system size so a word cannot split. **The Android audit found touch targets below 48 dp (section 9, issue 9).**
3. **Screens around a decision** (`docs/SCREEN_DECISIONS.md`): one labelled Back button on every screen but Home, system Back unwinds result, start, place, Home; no role switcher; the demonstration is a labelled mode, not mixed with personal data.
4. **Journey in four parts** (R1, R2, R3): the result leads with the place, the person's needs as labels, the route title and one sentence; then Transport, Transfers, Final approach, Correct entrance, each with what is known, what is missing, how old, and what to do next. Next steps come only from data present (OpenStreetMap page link; a phone number or website OpenStreetMap lists, shown as "not checked by us"; another route; check again). A walking distance never proves step-free access; nothing is invented.
5. **Service audit** (R5): see `docs/SERVICE_TERMS_AUDIT.md`. Code changes: no OSM editing API; Nominatim at most 1 request per 1.1 s, cached 30 min (10 min for "no match"), identical simultaneous requests merged; native User-Agent names the application id, version and project URL; TfL Ordnance Survey attribution and a non-endorsement line; tappable OpenStreetMap licence link; typed start limited to a UK postcode sent to TfL only.
6. **Honest states** (R6): live vs demonstration labelled on every screen; "What answered" card per service with its age; partial failures shown per service; offline wording; evidence older than 15 minutes stops counting; "Check again" is disabled while running and identical requests are merged.
7. **Recovery and `busy`** (R7): the recovery code screen was removed and the app says the answers cannot be restored; `busy` sticking is fixed with `TripRunner` (also ignores late answers) and unit-tested including the regression.
8. **Android tests and evidence**: Maestro flows, `android-tests/run.sh`, emulator and evidence-publishing jobs in `.github/workflows/build.yml`; signing-consequence check, identity record and private-key detection in the same workflow.

## 4. Main journey (exact steps)

1. Install `AccessChain-test.apk` (one-time uninstall of any older build: new application id). Open it.
2. Home: tap "Tell us what you need". Tap what applies (default: "I can't manage steps", "Lifts are fine"). Optional numbers behind "Walking and doorway details". "Save and see my routes".
3. "Use live information?": choose "Yes, use live information" (TfL and OpenStreetMap are contacted) or "No, use the demonstration instead" (made-up places, nothing leaves the phone). **Manual step: this choice. Missing-service step: with no internet the live choice shows per-service "no answer" notices.**
4. Live: choose one of 10 South Bank places, then a start: one of 5 stations, or type a UK postcode, or "Where I am now" (the screen explains first; the phone then asks; refusing is handled).
5. Result: place, needs labels, route title and one sentence, then the four parts; "Turn-by-turn directions from TfL"; "Read this route as plain text"; "What answered"; "Check again".
6. Demonstration: same layout with made-up data; "Demonstration options" lets you pretend 45 minutes passed to see evidence expire.

## 5. Android verification facts (emulator only)

CI run 49 (`main`, release) and run 48 (branch), both on commit `3056285fb9b71e1fa328a82a11ec3e816aea8da0`. The emulator flows produced the same pass/fail list in both runs (durations differ).

**Job results, run 49 (main):** `test-and-web` success; `live-smoke` success; `android-apk` success; `android-emulator (api36-pixel6-standard)` success; `android-emulator (api29-pixel5-text200-dark)` success; `publish-evidence` success; `publish-release` success.
**Job results, run 48 (branch):** `test-and-web` success; `live-smoke` success; `android-apk` success; both emulator jobs success; `publish-evidence` success; `publish-release` skipped (branch runs do not publish releases).

| Item | API 36, Pixel 6 profile (1080x2400, density 420, font 1.0, light) | API 29, Pixel 5 profile (1080x2340, density 440, font 2.0 = 200%, night requested) |
|---|---|---|
| Install | PASS: "Success" (streamed install) | PASS: "Success" |
| Required flows: 01 first run, 02 main task, 04 Back, 05 keyboard, 06 settings/about, 08 save and kill, 09 relaunch, 10 long screen, 15 encryption check | PASS 9/9 (`log.txt`, `junit/`) | PASS 9/9 |
| Informational flows: 03 live journey, 07 location denied, 11 offline | 3/3 exit 0 (see below) | 3/3 exit 0 |
| Cold start (5 runs, `am start -W` TotalTime) | 567, 585, 589, 581, 582 ms (median 582 ms) | 554, 614, 627, 601, 648 ms (median 614 ms) |
| Memory (`dumpsys meminfo`, one sample after the flows) | TOTAL PSS 70,683 kB | TOTAL PSS 78,194 kB |
| Scroll jank (`gfxinfo`, longest screen) | 70.3% of frames janky (90/128); p50 61 ms, p90 85 ms, p99 97 ms | 97.9% (189/193); p50 53 ms, p90 73 ms, p99 129 ms |
| Upgrade from previous APK | NOT TESTED (no earlier APK with this id) | NOT TESTED |
| Signing consequence (throw-away key) | PASS: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`; data survived (flows 08/09 pass after it) | PASS (same) |
| TalkBack | Experiment only (below) | NOT TESTED: TalkBack not installed on this image |

- **Live journey (informational):** API 36, run 48: "What answered" shows OpenStreetMap, TfL journey planner and TfL lift list all "answered just now" for Tate Modern from London Bridge. The result shows "Walk about 930 m (14 min)", "1 of 2 parts confirmed. Not confirmed: Final approach", a community phone number labelled "not checked by us", and "We have not checked any of this ourselves" (`docs/evidence/emulator/api36-pixel6-live-result-top.png`, `api36-pixel6-live-what-answered.png`). API 29 (run 48): the flow passed, but the saved frames show only the attribution text, so which services answered is not visible in the saved evidence.
- **Offline (airplane mode, API 36):** "We couldn't reach OpenStreetMap to find Tate Modern. Please check your connection and try again." "What answered": OpenStreetMap "no answer. Check your connection"; TfL journey planner and lift list "not asked". No route is shown. Result: PASS (`docs/evidence/emulator/api36-pixel6-offline-live.png`). API 29 shows the same OpenStreetMap notice (`api29-pixel5-200pct-offline-live.png`).
- **Location:** API 36: `ACCESS_COARSE_LOCATION granted=false` with `USER_FIXED` (permanent denial). The app's manual start still shows the postcode field and "Where I am now", and explains that location is off for this app (`api36-pixel6-location-denied.png`). PASS. API 29: denied, `USER_FIXED` not shown in `dumpsys`; flow passed.
- **Back / predictive back:** flow 04 passes on both (result to start to place to Home to leaving). Predictive back is enabled in the manifest (`enableOnBackInvokedCallback="true"`, CI check). The predictive back animation was not observed.
- **Keyboard:** flow 05 opens the number keyboard on the walking field and reaches and taps "Save and see my routes". **Frame check:** in `api36-pixel6-keyboard-needs.png` and `api29-pixel5-200pct-keyboard-needs.png` the keyboard covers the lower part of the form and the Save button is not in the frame; reachability depends on the flow's scroll. Known issue 10.
- **Permissions:** `INTERNET` and `ACCESS_COARSE_LOCATION` only (section 2).
- **Background / relaunch / process death:** flows 08 and 09 save needs, choose demonstration, kill the process (`am kill`), relaunch. `api36-pixel6-after-kill-restored.png` shows the demonstration result with the saved "No steps" and "Lifts are fine" needs. PASS on both emulators.
- **Encryption self-check:** "Encryption check: passed" on API 36 (`api36-pixel6-encryption-check.png`): key saved and read back, made-up text encrypted and not visible in the stored form, the encrypted text opens with the same key, one changed character refused, the same text for a different item refused, a different key refused. Flow 15 passes on both emulators.
- **Dark theme on Android:** API 29 `device.txt` records `night=yes`, but the in-app screenshots are light, so **dark mode is not verified on Android** (the browser tests check the dark palette only).
- **TalkBack experiment (API 36 only, non-gating):** TalkBack was installed and switched on; its screenshots and logs are in `talkback/` (run 48). The harness printed "Bad arguments" once, and TalkBack logged that its speech engine was not ready at first. This experiment establishes only that TalkBack ran; **no usability result is claimed**.
- **Emulator limits:** software rendering, so jank and timings are not representative of a phone; no real GPS; live results depend on the day's real TfL and OpenStreetMap data (recorded, never asserted).
- **Physical device: NOT TESTED.**

## 6. Visual and accessibility evidence

- Before/after screenshots at Pixel 7 and 320x568, light and dark, 200% text: `docs/evidence/before/` (commit 8907428, built in a git worktree) and `docs/evidence/after/` (browser, mocked network).
- Emulator screenshots (19 PNG, copied from runs 48/49 into `docs/evidence/emulator/`, names give API level and flow; see `docs/evidence/emulator/README.md`). Full set, recording and hierarchy dumps: branch `evidence/run-48` and `evidence/run-49` (`main-task.mp4`, `shots/*`, `maestro/*/`, `hierarchy/*.xml`, `a11y-tree.jsonl`).
- **Frames checked by eye in this pass:** API 29 at 200% (first run, main-task result, needs with keyboard, About this build, live attribution, offline); API 36 (first run, needs, result top, correct entrance, live result, live what-answered, offline, keyboard, location denied, restored after kill, encryption check). At 200% the frames show large text wrapping without clipped words; the first-run headline "AccessChain" does not break. The frames checked at 200% show no clipped text, but this is a visual check of a few frames only.
- **Accessibility-tree audit (`a11y-tree.jsonl`, API 36):** no app control without a name. **Undersized controls (below 48 dp = 126 px at density 420):** the first-run "Extra large text" choice (906x63 px, about 24 dp tall) and the "OpenStreetMap copyright and licence" link (906x81 px, about 31 dp). Several "undersized" entries in the audit belong to the launcher (back navigation), not to the app. The API 29 audit shows only launcher entries. Known issue 9.
- Contrast: unit-tested (7:1 for text in both themes; `apps/mobile/src/design/tokens.test.ts`). Touch targets: 56 px checked by `auditLayout` in the **browser** layout at three phone sizes, normal and 200% text (CI run 49, `test-and-web`); the Android audit above finds smaller controls, so the browser check does not cover the Android result.
- Combination limit: the in-app Extra large (1.4x) on top of a 200% system size (2.8x) is **not guaranteed** to fit; 200% alone and 1.4x plus 140% are tested in the browser. Not tested on Android.
- axe (WCAG 2 A/AA) passes on every screen in light, 200% text and dark in the browser (CI run 49). These are automated checks and find only part of the real problems.
- **TalkBack: NOT TESTED** for usability. Labels, roles and live regions are set and checked by axe in the browser, but nobody listened to the app with a screen reader.
- Defects found by looking at emulator screenshots and fixed earlier: an internal source id shown to the reader; the headline "AccessChain" breaking mid-word at 200%; screens that kept the previous scroll position after navigation.

## 7. Test evidence

Commands in CI (`test-and-web` job, run 49, all success): `npm run typecheck`; `npm test` (core, db, mobile unit tests); `npm run build:web -w @accesschain/mobile`; `npm test -w @accesschain/e2e`; `live-smoke` job against the real services.

- **Unit tests:** pass in CI run 49. Per-package test counts were not extracted from the job log in this pass, so no count is given here. Coverage areas: design tokens (contrast both themes, sizes), account id, `TripRunner` (incl. `busy` regression, stale answers); core: journey brief (four parts, no step-free claim from distance, contact next steps only when present, comparison only inside one result, source ids hidden), client (per-service failure, slow vs offline, merged duplicate requests, retry, 1 request per second, cached "no match", `planTrip` never throws, postcode to TfL only), app config (id, version, permissions, ports, meta tag).
- **Browser end-to-end:** 123 passed, 3 skipped (the real-service spec is skipped in the browser projects and runs in `live-smoke`, which passed), across three projects (Pixel 7 size, 390 px, 320 px).
- **Emulator:** 9/9 required flows and 3/3 informational flows pass on API 36 and on API 29 (run 48 and run 49).
- **Failures met and fixed:** layout text spilling in a 13-letter word at 320 px / 200% (word wrap); text scrolled under the app bar counted as overlap (audit clipped); faded animation read by axe as low contrast (tests use reduced motion); a Back test that assumed saved needs; emulator flows that assumed content was above the fold at 200% text and scrolled too far per step.
- **Negative tests:** lifts unavailable is not "fine"; undated or old notes are not evidence; garbage responses; 404, 300, offline, timeout; personal details in a report note are held back.
- **What the tests do NOT establish:** that any real place is accessible; that the pavement is step-free (nobody publishes it); behaviour on a physical phone; TalkBack behaviour; that real older users understand the wording; the long-term behaviour of TfL and OpenStreetMap; that the User-Agent is actually sent by the Android HTTP stack (not observed); smooth scrolling on a phone (the emulator measurements are software-rendered).

## 8. Privacy and security

- Leaves the device (live mode only, after consent): to TfL the start (station id, location rounded to about 100 m, or a typed UK postcode) and the place's coordinates, plus the internet address; to OpenStreetMap a fixed place name, plus the internet address. **The needs profile is never sent** (tested in the browser and in CI).
- Who can read what: needs are readable only on the phone with the key; the key is in the phone's secure store, not backed up. TfL and OpenStreetMap can see the requests above.
- Recovery / revocation / deletion: no recovery (answers cannot be restored); deletion removes answers, key and install id from this phone; copies made elsewhere (screenshots, text copied from the plain-text view) are not affected.
- Checked vs intended: the encryption and key-loss behaviour was checked in the browser build (CI) and by the on-phone self-check on both emulators (API 36 and API 29). Nobody has reviewed the Android secure-store path, and the Keystore's hardware backing on real phones is not checked. No independent cryptographic, privacy or accessibility review has been done.
- Service terms: see audit. Open items: no proxy for Nominatim (policy requires being able to switch without an update), TfL anonymous use and branding guidelines, an LLM-related clause in the Nominatim policy that needs a deliberate owner decision.
- Signing: the release APK is signed with the public Android debug key. Its signer certificate is `CN=Android Debug`, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (from the `apksigner` output in `build-identity.txt`), which is the public key, not a private one (`docs/SIGNING.md`).

## 9. Known issues

| # | Severity | Issue | Impact | Repro | Code | Proposed fix |
|---|---|---|---|---|---|---|
| 1 | High | Public Nominatim without a proxy: cannot be switched without an app update and all users share its 1 request/second | Could be blocked; policy breach at scale | n/a | `packages/core/src/live/client.ts` | Small proxy/cache, owner decision |
| 2 | High | The pavement and crossings are never evidenced, so real results are almost always "We can't be sure yet" | Useful for what to ask the venue, not for a go/no-go | any live result | by design | Field verification, licensed data |
| 3 | Medium | Community notes are often undated (edit dates are no longer read) | Entrance often "not confirmed" | Borough Market | `osm.ts` | A permitted read-only source of edit dates |
| 4 | Medium | In-app Extra large on top of a 200% system size can break very long words | Large-text users with both | 2.8x text | `ui.tsx` | Cap in-app size when system size is large |
| 5 | Medium | No TalkBack usability test, no physical device, no usability sessions | Unknown real-world problems | n/a | n/a | Run the plan |
| 6 | Medium | Dark theme not verified on Android: API 29 requested night mode but the app screenshots are light | Dark colours untested on a phone | API 29 run 48 | `design/theme.tsx` | Check on a device |
| 7 | Low | Unsaved answers are lost if the app is killed (by design, nothing is written in the clear) | Re-type on the needs screen | kill during editing | `Needs.tsx` | Sealed drafts if wanted |
| 8 | Low | Reports are not sent anywhere | Feature incomplete (labelled) | Tell us about a problem | `Report.tsx` | Build the moderated intake |
| 9 | Medium | Android accessibility audit: touch targets below 48 dp: the "Extra large text" choice (about 24 dp tall) and the OpenStreetMap licence link (about 31 dp). The browser "56 px" check does not cover this. | Smaller targets for users with motor difficulty | API 36 run 48, `a11y-tree.jsonl` | `apps/mobile/src/ui.tsx`, first-run and live screens | Make the choice and link at least 48 dp tall |
| 10 | Medium | At 200% text the number keyboard covers the lower part of the needs form; the Save button is not visible in the saved frames | Users must scroll to find Save while the keyboard is open | API 36 and API 29, flow 05 frames | `Needs.tsx` | Keep the focused field and Save above the keyboard (check on device) |
| 11 | Medium | Build identity record: `signer cert SHA-256: UNREADABLE` in `build-identity.txt` and the release notes, although the same record's `apksigner` excerpt contains the debug certificate's digest. The parser did not extract it. | Build identity is incomplete; the signer cannot be read from the record | release `latest-test-build` (run 49) | `scripts/apk-identity.sh` | Fix the digest extraction; the run-49 APK digest is in `build-identity.txt` |
| 12 | Medium | Scroll jank measured at 70% (API 36) and 98% (API 29) janky frames on software-rendered emulators | Not a phone measurement; a real phone may differ | `scroll-gfxinfo.txt`, both runs | `Needs.tsx`, list rendering | Measure on a device before tuning |
| 13 | Medium | Upgrade from a previous APK NOT TESTED (new application id) | Upgrade path from the earlier test builds is unverified; the old build id needs an uninstall | n/a | `app.config.js` | Test on a device when a previous build of this id exists |
| 14 | Low | When OpenStreetMap is offline, the TfL services show "not asked" rather than "no answer" | Users may wonder why TfL was not checked | airplane mode, run 48 | `client.ts` | Explain in the copy, or ask TfL in parallel |

## 10. Next actions

1. Owner: decide on the Nominatim proxy and TfL registration (cost: a small server; blocks wider use).
2. Owner: decide whether to create a private release key (`docs/SIGNING.md`, steps 1 to 4). Until then every build is a public-debug-key test build.
3. Fix issues 9, 10 and 11 in code and re-run the emulator jobs (touch targets, keyboard and Save position, digest extraction).
4. Owner: read TfL's live licence page and branding guidelines in a normal browser.
5. Run the usability sessions in `docs/USABILITY_SESSION_PLAN.md` with older and disabled participants (needs recruitment and consent; blocks any claim about understandability).
6. Run the app on a physical Android phone with TalkBack, large text, dark mode, and an upgrade from an earlier build of this id.
7. Field-check a few places (pavement and entrance) so "Final approach" can be evidenced.

## Requirements checklist

Evidence column: a run id, file or test that backs the result.

| ID | Requirement | Result | Evidence |
|---|---|---|---|
| Shared 1 | Identity: id, version 0.2.0, version code, build info in About, ports, `application-id` test, blocked permissions, no backup, predictive back | PASS | Run 49 `test-and-web` (identity test, ports); `package.txt` run 48 (INTERNET + COARSE_LOCATION only); About shows "Version 0.2.0 (build 48)" in `api36-pixel6-about-build.png`; `allowBackup=false` (CI) |
| Shared 2 | Design foundation: contrast light and dark, 200% text, reduced motion, states | PARTIAL: browser PASS; Android: dark not verified (issue 6), undersized targets (issue 9), 2.8x combination not guaranteed | `tokens.test.ts` (run 49); `a11y-tree.jsonl` run 48; `api29-pixel5-200pct-*.png` |
| Shared 3 | Screens around a decision, no persona switcher, demo labelled, incomplete features labelled | PASS | `docs/SCREEN_DECISIONS.md`; `api36-pixel6-main-task-correct-entrance.png` (demo label) |
| Shared 4 | Android behaviour: back, keyboard, permission denial, relaunch, offline, upgrade | PARTIAL: back PASS (flow 04); keyboard PASS flow, Save not in frame (issue 10); permission denial PASS (API 36 permanent); relaunch PASS; offline PASS; upgrade NOT TESTED | run 48 `log.txt`; `api36-pixel6-after-kill-restored.png`; `api36-pixel6-location-denied.png`; `upgrade.txt` |
| Shared 5 | Evidence before/after, docs, report, usability plan | PASS for documents and screenshots; usability sessions NOT RUN | `docs/evidence/before`, `docs/evidence/after`, `docs/evidence/emulator/README.md`, `docs/USABILITY_SESSION_PLAN.md` |
| R1 | Lead with the journey and constraints | PASS (browser tests check the order); not tested with people | `api36-pixel6-main-task-result-top.png`; `live.spec.ts` |
| R2 | Transport, Transfers, Final approach, Correct entrance with known / missing / age | PASS | `api36-pixel6-main-task-correct-entrance.png`; run 49 e2e |
| R3 | Useful next steps from available data; nothing invented | PASS (tests); not tested with people | `api36-pixel6-live-result-top.png` (phone number labelled "not checked by us") |
| R4 | Readable text itinerary; no fake map; manual origin; denied permission handled | PASS on Android (permanent denial, manual start); PASS in browser; map not built | `api36-pixel6-location-denied.png`; `location-permission-state.txt` |
| R5 | Service audit and app adjustments | PARTIAL: Nominatim, OSM API, OSM tiles/attribution read in full; TfL licence read from an archive copy; owner decisions open | `docs/SERVICE_TERMS_AUDIT.md` |
| R6 | Honest live/demo labels, ages, offline/slow/partial failure, retries | PARTIAL: live and offline states PASS on API 36; slow network NOT TESTED on a device | `api36-pixel6-offline-live.png`; `api36-pixel6-live-what-answered.png`; run 48 flows 03 and 11 |
| R7 | Recovery gap honest; `busy` bug fixed with a test | PASS | `docs/ENCRYPTION_ACCOUNT.md`; `tripRunner` unit test (run 49) |
| R8 | Android flows (live informational, demo main), evidence, report | PARTIAL: 9/9 required and 3/3 informational flows pass on both emulators; no physical device; TalkBack usability NOT TESTED; upgrade NOT TESTED | run 48 and run 49 `log.txt`, `junit/`; `evidence/run-48`, `evidence/run-49` |
| Lead L1 | Application id, version, ports, id test | PASS | as Shared 1 |
| Lead L2 | Forbidden permissions blocked/checked | PASS | `package.txt` run 48; CI permission check (`android-apk`, run 49) |
| Lead L3 | Encryption wording accurate, `docs/ENCRYPTION_ACCOUNT.md` | PASS (document exists); the wording on screen is checked by the encryption self-check | `docs/ENCRYPTION_ACCOUNT.md`; `api36-pixel6-encryption-check.png` |
| Lead L4 | On-device encryption self-check passes in the CI emulator | PASS (both emulators) | flow 15 in run 48 and run 49 `log.txt`; `api36-pixel6-encryption-check.png` |
| Lead L5 | Release signing prepared (secrets-driven, no keys in git) and `docs/SIGNING.md` | PASS for preparation; PARTIAL: no private key exists, release is debug-signed | run 49 `android-apk` (`Detect the owner's private signing key` ran; `Point Gradle...` skipped); `docs/SIGNING.md` |
| Lead L6 | APK identity in `build-identity.txt` and release notes | PARTIAL: record exists (package, versionCode 49, commit, run, APK SHA-256); signer digest UNREADABLE (issue 11) | release `latest-test-build` (run 49) |
| Lead L7 | A11y tree audit and TalkBack probe/experiment recorded | PARTIAL: audit recorded with undersized targets (issue 9); TalkBack experiment on API 36 only; API 29 TalkBack NOT TESTED | `a11y-tree.jsonl`; `talkback/result.txt` (run 48) |
| Lead L8 | Maestro flows for main task incl. back, keyboard, process death, offline | PASS (flows run; keyboard and offline notes as above) | run 48 `log.txt` flows 01 to 11 |
| Lead L9 | `docs/USABILITY_SESSION_PLAN.md` = NOT RUN | PASS (document; results NOT RUN) | `docs/USABILITY_SESSION_PLAN.md` |
| Lead L10 | Settings > About shows the build | PASS | `api36-pixel6-about-build.png`, `api29-pixel5-200pct-about-build.png` |
