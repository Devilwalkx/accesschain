# AccessChain – Data flows (DRAFT)

Privacy modes are explicit. **Provider-managed** means authorised server processes can read the data. **Client-side encrypted** means only enrolled devices hold keys and the server stores ciphertext plus minimal metadata. **Public** means intentionally readable by anyone. A third-party route lookup is none of these: the provider sees what we send.

## F1 – Requirements profile (private, client-side encrypted)

1. User enters needs on the phone. Fields: avoid steps, max walk, min width, rest gap, toilet, lift/assistance acceptable. No diagnosis field.
2. The 32-byte content key is generated on-device (CSPRNG) and stored in Keychain/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
3. Profile is sealed with XChaCha20-Poly1305; AAD binds account, item id and version.
4. Ciphertext is kept in device secure storage (this build). Optional backup uploads the ciphertext envelope to `private_items`.
5. Matching runs **on-device**. Plaintext profile never reaches the server, logs, analytics or crash reports.

Server sees: account id, item id, version, ciphertext size, timestamps. Metadata is still personal data.

## F2 – Route lookup (third party sees data)

1. User picks a manual origin, or taps once for coarse foreground location.
2. Origin is rounded to 3 decimal places (~100 m) before leaving the device. Destination venue id is a public identifier.
3. Adapter calls a licensed route service with timeout and response validation.
4. The provider learns an approximate origin and the destination. This is disclosed in the UI and is **not** claimed to be private or zero-knowledge.
5. Candidates return to the device; the profile is matched locally. Failure ⇒ visible "unavailable"; no cached all-clear.

*Implemented (D-019):* the provider is TfL's Unified API. Controller/processor roles and the transfer position for TfL and for OpenStreetMap services are still **open** (PRIVACY_REGISTER).

## F3 – Public venue facts and feeds

Licensed feed snapshots and partner/field/user observations enter the append-only `observations` store with source, verifier type, observed/retrieved/expiry. Feeds without licence/attribution are rejected by both code and DB constraint. Public output is non-personal venue data.

## F4 – Community reports

1. Report is validated against a strict schema (no identity or needs fields), rate-limited and de-duplicated.
2. Photos are re-encoded on-device, metadata removed and **re-verified** before upload.
3. Notes with email/phone/postcode/home/health references are held for moderation and must be redacted before approval.
4. Moderator approval creates a public `user_report` observation with a generic source id. The reporter pseudonym is dropped. User reports are never "verified".
5. `report_queue` rows are purged after a retention period that is **still to be decided** (RETENTION.md).

## F5 – Partner venue edits

Partners authenticate (to be built), may add `venue_report` observations under their own source id and withdraw only their own. They cannot delete or alter any observation, cannot withdraw community reports, and cannot record disputes. Moderators record disputes; both sides remain visible.

## F6 – Backup, recovery, deletion

- **Recovery (as built in the Android app): none.** The app used to show a "recovery code" but never stored the wrapped key or built a restore, so the code could not restore anything; the screen was removed (DECISIONS D-026). The answers live only in this phone's secure store and are not backed up (`allowBackup=false`). If the phone or key is lost, the answers are gone and the person answers the questions again. The app says so in Privacy and help.
- *Design intent for a future server (not built):* a 256-bit recovery secret wrapping the content key (HKDF-SHA256 + XChaCha20-Poly1305, bound to the account), the server holding only the wrapped blob. The core functions exist and are unit-tested; no app screen uses them.
- A password reset yields no key material; if all trusted devices **and** any recovery secret are lost, private content is permanently unrecoverable.
- Deletion writes a tombstone. Restore ignores tombstoned items and entries belonging to other accounts. Backups expire on a schedule to be set; restore/delete drills are not yet run.
- Revocation/deletion cannot remove copies a user exported or screenshotted.

## F7 – Support and operations

Support sees non-content diagnostics only. No routine access to ciphertext; no session replay; logs pass through `redactForLog` (coordinates, postcodes, profile keys). Notifications (when built) are generic, e.g. "Your saved journey changed".

## F8 – Sharing (not in MVP)

Itinerary sharing is intentional and per item. It needs an authenticated recipient-key design that has not been reviewed, so it is **not built**; see DECISIONS D-005.

## F9 – Live place information (implemented)
1. After consent (screen explains what is sent), the app asks OpenStreetMap's Nominatim service for the venue by **name** (browser or phone), at most once per second and cached for 30 minutes. The OSM editing API is **not** called (OSMF policy: not for read-only use; D-024).
2. It asks TfL for step-free journeys from the chosen station id, a location rounded to ~100 m, or a UK postcode the person typed (sent to TfL as typed, never to OpenStreetMap) to the venue's coordinates, and for TfL's list of lift problems.
3. Responses are validated, converted to observations with source, date and 15-minute (TfL) or two-year (community) expiry, and matched **on the device** against the private needs profile.
4. Nothing from the profile, and no results, are sent anywhere. The services see the device's IP address. Requests are visible in the browser's network tools; the test suite asserts their content.
