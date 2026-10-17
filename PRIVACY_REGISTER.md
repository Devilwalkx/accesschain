# AccessChain – Privacy register (DRAFT for specialist review)

This is a working draft. It is **not** legal advice or a compliance certification. Roles, bases and retention below are proposals and open questions. Nothing here records consent, contracts, registrations or approvals that do not exist. Check current ICO guidance, including the Data (Use and Access) Act 2025, before relying on any entry (the ICO pages could not be fetched from the build environment, so none was checked in this session).

## 1. Processing inventory

| # | Operation | Individuals | Data | Source | Recipients | Mode |
|---|---|---|---|---|---|---|
| P1 | Private requirements profile | Travellers | Mobility/access preferences (may reveal health) | User | None (device); ciphertext to backup store | Client-side encrypted |
| P2 | Saved trips | Travellers | Origins, destinations, times | User | None; ciphertext only if backed up | Client-side encrypted |
| P3 | Route lookup (live mode, implemented) | Travellers | Start station id or location rounded to ~100 m; venue coordinates; the device's IP address (seen by the services) | Device | TfL (api.tfl.gov.uk) | Third party sees data |
| P3b | Place lookup (live mode, implemented) | Travellers | Venue name (not personal); IP address | Device | OpenStreetMap Nominatim / OSM API | Third party sees data |
| P4 | Account and security | Account holders | Identifier, device records, session data | User | Auth provider (**TBD**) | Provider-managed |
| P5 | Community reports | Contributors; incidental third parties in photos/notes | Pseudonym, observation, optional note/photo | User | Moderators; public after approval | Public after moderation |
| P6 | Partner/moderator accounts | Staff of venues and of us | Name/work email, role, actions | User | Admins | Provider-managed |
| P7 | Public venue facts | None intended | Venue/entrance facts, source types | Feeds, partners, verifiers | Public | Public |
| P8 | Backups and recovery blobs | Account holders | Ciphertext | Device | Storage provider (**TBD**) | Ciphertext only |
| P9 | Audit/history | Staff, contributors | Actor id, action, time | System | Admins | Provider-managed |
| P10 | Support | Account holders | Diagnostics (no content) | System | Support staff | Restricted |

## 2. Controller/processor map (to be confirmed by counsel)

| Operation | Proposed role of AccessChain | Reasoning to test |
|---|---|---|
| P1, P2 (device-held) | Mostly not receiving the data; for backups, likely controller of ciphertext/metadata | Even ciphertext plus metadata may be personal data |
| P3 | Controller for what it sends; route provider may be independent controller or processor | Depends on provider terms (**open**) |
| P4, P6, P9, P10 | Controller | Own account/security purposes |
| P5, P7 | Controller for moderation/publication | Public interest in access info is **not** a basis by itself |
| Hosting, auth, email/push | Processors under contract | Contracts not in place |

## 3. Lawful basis (Article 6) and special category (Article 9)

| Operation | Proposed Art 6 basis (to confirm) | Art 9 | Notes |
|---|---|---|---|
| P1/P2 | Contract (objectively necessary to provide the planner), or consent for optional backup | Access needs can be health data even without a diagnosis; a condition (likely explicit consent) must be identified before any server-side processing. Device-only processing may avoid receiving it, **confirm with counsel** | Do not assume contract covers optional analytics/marketing; there is none |
| P3 | Contract/legitimate interests (**open**) | Origin/destination patterns can be sensitive | Minimised and disclosed |
| P4 | Contract; legitimate interests (security) | – | |
| P5 | Legitimate interests, to be assessed with a balancing test | Notes may reveal health; heuristic flagging and moderation reduce this | Third parties in photos need handling (§6) |
| P6, P9 | Legitimate interests / contract | – | |

**Uploading third-party information:** reports may capture other people (faces, interiors). The app warns, strips metadata and asks users to avoid people; the uploader's authority to disclose others' information is not established and must be assessed. Moderators must reject photos with identifiable bystanders.

**Criminal-offence data:** not processed. No allegation or offence reporting feature exists.

## 4. DPIA screening

Screening result: **a DPIA is likely required** before any real-user pilot (health-adjacent data, potentially vulnerable users, location data, new technology). Status: **not started**. If residual high risk cannot be mitigated, consult the ICO before processing.

## 5. Suppliers (none selected) / international transfers

Needed: hosting (PostgreSQL, storage, jobs), authentication, email/push, route provider, feed sources, monitoring. For each: processor terms, subprocessors, region, support-access, retention, deletion, transfers. "UK region" is a preference, not proof of no overseas transfer: support access and subprocessors must be assessed. Cost/region table: DECISIONS D-004.

## 6. Rights, complaints, PECR, incidents

- **Rights (access, rectification, erasure, restriction, objection, portability):** export and delete are designed per account; third-party rights (photos) must be protected. Response-time tracking to follow current statutory timing (generally one month for access requests, with exceptions); not built.
- **Erasure:** tombstones prevent resurrection on restore; backups expire on a schedule to be set; copies already exported/screenshotted cannot be recalled.
- **PECR:** no marketing, no non-essential cookies/trackers/analytics in MVP. Push notifications are generic service messages. Any later marketing or tracking needs a fresh PECR and UK GDPR assessment.
- **Incidents:** log, assess risk, escalate to the ICO within 72 hours where required and notify affected people where the high-risk threshold is met; processors must escalate fast enough. A runbook has **not** been written or exercised.
- **Ownership:** no named privacy/security owner, DPO assessment, or ICO fee assessment yet.

## 7. Open decisions (owner / launch impact)

| ID | Decision | Owner | Blocks |
|---|---|---|---|
| PR-1 | Art 6/9 basis per operation incl. whether device-only profile is "processed" by us | Counsel | Any real-user pilot |
| PR-2 | TfL and OpenStreetMap service terms, fair-use limits, and controller/processor/transfer position (both are now contacted in live mode; IP addresses are exposed; TfL terms text could not be read) | Counsel + engineering | Wider use of live mode |
| PR-3 | Contributor/photo bystander approach | Counsel + moderation lead | Public reports |
| PR-4 | Retention periods (RETENTION.md) | Privacy owner | Pilot |
| PR-5 | Supplier selection and contracts | Founder | Backend build |
| PR-6 | DPIA | Privacy owner | Pilot |
