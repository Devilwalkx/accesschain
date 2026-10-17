# AccessChain

Personalised access-information journey planner for **one London area and 50 field-checked destinations** (target). It joins transport, the final pavement approach and the correct venue entrance, and shows what is **missing, stale or disputed**. It never turns unknown into "accessible".

> **Status: early build on synthetic data.** No real access information, no real users, no server, never run on a physical device. See [STATUS.md](STATUS.md) for exactly what is implemented, tested, simulated, reviewed and blocked.

## Layout

| Path | What |
|---|---|
| `packages/core` | Decision logic in TypeScript: evidence/freshness, deterministic matching, private vault, privacy helpers, fact store, report intake, route-adapter contract, synthetic data, demo |
| `packages/db` + `db/schema.sql` | PostgreSQL schema (append-only observations, ciphertext-only private items, RLS) tested with PGlite |
| `apps/mobile` | Expo / React Native client (synthetic data, text-first itinerary, encrypted local profile) |
| `docs/DEMO.md` | Generated synthetic walkthrough |
| `SPEC.md` `DATA_FLOWS.md` `THREAT_MODEL.md` `PERMISSIONS.md` `PRIVACY_REGISTER.md` `RETENTION.md` `RISK_REGISTER.md` `SECURITY_TESTS.md` `DECISIONS.md` | Design and risk documents (drafts for review, not legal certification) |

## Commands

```bash
npm install
npm test            # 67 automated tests (core + database)
npm run typecheck
npm run demo        # regenerate docs/DEMO.md
cd apps/mobile && npx expo export --platform android   # bundling check (no device needed)
```

## Principles

1. Three outcomes only: known fit, known barrier, insufficient evidence. No score.
2. Expired, missing or conflicting evidence is unknown, never a pass.
3. Private needs stay on-device, encrypted; the server (when built) holds ciphertext only.
4. Public facts are append-only with provenance; venues cannot suppress contrary reports; subscriptions never affect assessment or ranking.
5. No continuous location tracking, no diagnosis capture, no analytics in the MVP.

Do not describe this as "production ready", "fully GDPR compliant" or "accessible/safe". None of those is true or tested here.
