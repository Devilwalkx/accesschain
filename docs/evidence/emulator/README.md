# Emulator evidence (AccessChain, Android)

- Commit: 3056285fb9b71e1fa328a82a11ec3e816aea8da0
- CI runs: 49 (branch `main`, produced the `latest-test-build` release) and 48 (branch `claude/h-gm8m50`, same commit)
- Emulator only. No physical device was used.
- TalkBack: experiment only (API 36, not a usability test). No TalkBack screenshots are copied here; see branch `evidence/run-48`, folder `emulator-evidence-api36-pixel6-standard/talkback/`.

Files are named `api<level>-<device>[-200pct]-<flow>.png`:
- `api36-pixel6-*`: API 36, Pixel 6 profile, font scale 1.0, light.
- `api29-pixel5-200pct-*`: API 29, Pixel 5 profile, font scale 2.0 (200%).

The full set of screenshots, recordings and hierarchy dumps is on the evidence branches `evidence/run-48` and `evidence/run-49`.
