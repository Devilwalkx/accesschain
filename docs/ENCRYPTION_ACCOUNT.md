# Encryption and account: what is protected, how, and what is not

Status: describes build 0.2.0 as written in the code. Nothing here has been independently reviewed. "Encrypted" below always means the specific mechanism named; it is not a claim that the app is secure.

## What is encrypted, and what is not

| Data | Where it lives | Protected how |
|---|---|---|
| The needs profile (steps, lifts, walking distance, doorway width, rest gap, toilet, help at the door) | The phone only, as `ac.profile` in the app's secure storage | Encrypted with XChaCha20-Poly1305 before it is stored (below) |
| The key for that profile | The phone only, `ac.key.content` in the app's secure storage | Held by the platform secure store (Android: a key in the Android Keystore wraps it; the secure store is `expo-secure-store`). Whether that Keystore key is hardware-backed on a given phone was not checked. |
| Text size, colours, the live/demo choice, the random install id | Same secure storage, **not encrypted by us** (they are not secrets) | The platform secure store only |
| Journey lookups: the start (station id, location rounded to about 100 m, or a typed UK postcode) and the place's position, sent to TfL; a fixed place name sent to OpenStreetMap | Leave the phone | **Not encrypted by our key. They are sent to TfL and OpenStreetMap over HTTPS (TLS), so they are readable by those services and by anything that can break TLS. The services also see the internet address.** The needs profile is never part of them (tested). |
| Results of a lookup | Memory only, while the app is open | Not saved to disk; gone when the process ends |
| Logs | The app writes none of the profile. CI keeps a filtered `logcat` excerpt only for the emulator | n/a |
| Notifications | None exist | n/a |
| Backups | Android cloud backup is off (`allowBackup=false`, checked in CI). The secure-storage library also ships rules that exclude its data from backup and device transfer | The data is not copied off the phone by Android backup |

## The algorithm and the code

- Library: `@noble/ciphers` and `@noble/hashes` (pure JavaScript, published and widely used; no custom primitives are written by us). Composition (`packages/core/src/vault.ts`) has not been independently reviewed.
- Cipher: XChaCha20-Poly1305 (authenticated; 192-bit random nonce per item). Key: 32 random bytes from the operating system's random source through `expo-crypto`; if no secure random source exists the app refuses to start (it does not fall back).
- Binding: the "associated data" is `["accesschain/v1","item",accountId,itemId,version]`. A copy of the ciphertext moved to another item, account or version fails to open. Version numbers go up on every save.
- There is no plaintext copy of the profile on disk and no plaintext fallback: every failure throws and the app shows "could not be opened".
- HKDF-SHA256 exists in the code only for a recovery-wrap design that is **not used by the app** (see below).

## Keys: generation, storage, recovery

- Generated on the first save of the needs, on the phone. Never sent anywhere. Never shown. Never logged.
- Stored in the platform secure store. On the web build (browser tests only) the key sits in IndexedDB wrapped by a non-extractable WebCrypto key; that is weaker and is labelled as such in Privacy and help.
- **Recovery: not built.** The earlier "recovery code" screen could not restore anything (the wrapped key was discarded and no restore exists), so it was removed. If the phone is lost, the app is uninstalled, the data is cleared, or the key is lost, **the answers cannot be restored**; the person answers the questions again (about a minute). The app says this in Privacy and help. The functions `wrapKeyForRecovery` / `unwrapKeyFromRecovery` remain in `packages/core` with their tests as a starting point for a future, designed restore; no screen uses them.

## The account

There is no account, no login, no server and no sync. The "account id" in the encryption binding is a random per-install value (`acct-` plus 32 hex characters) stored beside the ciphertext; it only stops different installs sharing one binding string. Phones with answers saved by an older build keep opening them under the old fixed id. It is removed when the answers are deleted. Nobody else can see, reset or recover an account because none exists.

## Who can decrypt what

- The profile: only code running as this app on this phone, which can read the key from the secure store. Someone who unlocks the phone and opens the app sees the answers in the app. Other apps cannot read this app's private storage on an unrooted phone. A rooted phone or a malicious update signed with the same key is outside what this design protects against.
- The journey lookups: TfL and OpenStreetMap (and their infrastructure) see what is sent to them. We run no server and see nothing.
- Nobody can decrypt the profile "remotely": there is no copy anywhere else.

## Behaviour over the app's life (emulator facts, not physical-device facts)

| Event | What happens | Evidence |
|---|---|---|
| App goes to the background and the process is killed | Needs and the live/demo choice are still there after relaunch | Maestro flows `08` and `09` (CI emulators); `docs/ANDROID_PASS_REPORT.md` |
| Unsaved edits on the needs screen when the process is killed | Lost (nothing is written in the clear, no draft is kept) | By design |
| "Log out" | Does not exist (no account) | n/a |
| "Delete my answers" | Removes the ciphertext, the key and the install id from this phone | Browser test; Android not separately tested |
| Uninstall and reinstall | Everything is gone, including the key | Android behaviour; not separately tested |
| Upgrade with the same application id and signature | Data kept | CI installs the new APK over the previous release when the id matches |
| Install of an APK with the same id but a different signing key | Refused by Android; installed data untouched | CI "signing consequence" check (`signing-consequence.txt` in the evidence); `docs/SIGNING.md` |
| Lost key with ciphertext present | The app fails closed, says the answers cannot be recovered, and offers the questions again | Browser test |

## The on-phone check

Settings > About this build > "Check encryption on this phone" runs the app's real encryption code against this phone's real secure store, using made-up text and a temporary key that is deleted afterwards. It shows whether this build can store a key, encrypt, decrypt, and refuse a changed, mis-addressed or wrong-key copy. It touches none of the person's data and proves nothing about the strength of the algorithm, the hardware backing of the key, or data already stored. A Maestro flow asserts "Encryption check: passed" on the CI emulators.

## Not established

Hardware backing of the Keystore key on real phones; behaviour on a rooted phone; resistance to a memory dump of a running app; the safety of the JavaScript libraries beyond their public reputation; any legal or regulatory adequacy; anything about TfL's or OpenStreetMap's own handling of the data sent to them.
