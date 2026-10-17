# AccessChain – Specification (DRAFT)

Status: draft for review. Synthetic data only. Not legal advice; not a compliance certification.

## 1. Purpose

A personalised access-information journey planner for **one London area and 50 field-checked destinations**. It joins transport (arrival/transfer), the final pavement approach and the **correct venue entrance** into one itinerary, and shows what is missing, stale or disputed.

It cannot promise a journey is safe or accessible when required facts are unknown. Its core output is one of three states, never a score:

| State | Meaning |
|---|---|
| **Known fit** | Every requirement the user set has fresh, uncontested evidence that it is met. |
| **Known barrier** | At least one requirement is known (fresh, uncontested) not to be met. |
| **Insufficient evidence** | A required fact is missing, expired, in conflict, or the journey is not modelled end to end. **This is never presented as a pass.** |

## 2. Non-goals (MVP)

No worldwide routing engine; no invented paths; no continuous/background location; no diagnosis capture; no probability or "accessibility score"; no payment for ranking; no public contributor profiles or journey history; no promise of safety, legal compliance or "fully accessible".

## 3. Competitor position (NOT verified in this build)

Sociability and AccessNow provide venue access information; TfL publishes step-free topology and disruption data; existing route planners may already have substantial access features. **None of these pages could be fetched from the build environment** (network policy blocked them, see DECISIONS D-001), so this build makes **no claim** that a whole-journey gap exists. Validation of that gap (hands-on trials of each product with real users) is a Phase 0 task that remains open. A public documentation absence is not proof a feature is absent.

## 4. Workflow → implementation map

| # | Required behaviour | Where | Status |
|---|---|---|---|
| 1 | Local needs profile, no diagnosis | `core/profile.ts`, `mobile/NeedsScreen` | Implemented, tested |
| 2 | Manual origin; optional foreground location only | `mobile/location.ts` (one-shot, coarse, no background permission) | Implemented, **not device-tested** |
| 3 | Candidates from licensed service; never invented | `core/live/tfl.ts` + `live/client.ts`: **TfL Unified API** journey planner (step-free preference) and lift disruptions, validated against recorded responses (D-019). Licence text **not verified** | Implemented, tested (mocked + live smoke) |
| 4 | Segments: arrival/transfer/approach/entrance with source, observed/retrieved/expiry, conflicts | `core/types.ts`, `evidence.ts` | Implemented, tested |
| 5 | Deterministic matching; unknown ≠ pass; no score | `core/match.ts` | Implemented, tested (24 cases + mutation checks) |
| 6 | Recheck freshness before travel; alternatives only if evidence-backed; outage ⇒ unknown | `match.ts` `evidenceBackedAlternatives`, `itinerary.ts` `liveChanges`, `routes.ts` | Implemented, tested. Scheduled pre-departure recheck/notification **not built** |
| 7 | Text itinerary and map; entrance photos/directions | `itinerary.ts` text renderer; mobile text-first plan screen. **No map, no entrance photos yet.** | Partial |
| 8 | Moderated dated reports; no public exposure of needs/history | `core/reports.ts`, DB `report_queue` | Intake logic implemented, tested; **no moderation UI/service** |
| 9 | Partner venue editing without suppressing conflicts | `core/facts.ts`, DB triggers | Rules implemented, tested; **no partner portal** |

## 5. Data model summary

- **Private (ciphertext only, server cannot read):** requirements profile, saved trips, extracted preferences. Encrypted on-device, see DATA_FLOWS.md and `core/vault.ts`.
- **Public:** venues, segments, entrances, observations (source, verifier type, observed/retrieved/expiry, dispute links), licensed feed snapshots, verification badges (scope, method, verifier type, date, lapse date).
- **Operational:** accounts, devices, recovery blobs (ciphertext), tombstones, moderation history, minimal audit events (no content).

Observations are **immutable and append-only**. A venue partner can withdraw its own statement but cannot delete or suppress a contradicting report; withdrawals and disputes are logged.

## 6. Claims policy

Allowed: "reported", "observed on <date> by <source type>", "insufficient evidence", "checked by paid tester on <date>: <scope>". Not allowed: "accessible", "safe", "verified" without scope/method/date/verifier, "fully GDPR compliant", "production ready", any accuracy percentage not backed by a held-out field-validated set.

## 7. Launch gates (none satisfied)

Independent privacy/security review including the cryptographic composition and backend; field validation of every destination with paid disabled-user testers (screen reader and varied needs, real devices); verified licence/attribution for each feed; DPIA completed and signed off; processor contracts; incident procedure exercised; legal review of partner terms and badge wording.
