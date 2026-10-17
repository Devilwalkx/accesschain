import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cfg = JSON.parse(readFileSync(new URL("../../../apps/mobile/app.json", import.meta.url), "utf8")).expo;

describe("mobile app config (permissions minimised; verified once by `expo prebuild`)", () => {
  it("Android blocks background/fine location, microphone, camera-adjacent and broad storage permissions", () => {
    for (const p of ["ACCESS_BACKGROUND_LOCATION", "ACCESS_FINE_LOCATION", "RECORD_AUDIO", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"]) {
      expect(cfg.android.blockedPermissions).toContain(p);
    }
    expect(cfg.android.permissions).toEqual(["ACCESS_COARSE_LOCATION"]);
  });
  it("location plugin has no always/background modes", () => {
    const loc = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-location")?.[1];
    expect(loc.locationAlwaysPermission).toBe(false);
    expect(loc.locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(loc.isIosBackgroundLocationEnabled).toBe(false);
    expect(loc.isAndroidBackgroundLocationEnabled).toBe(false);
  });
  it("image picker requests neither camera nor microphone", () => {
    const ip = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-image-picker")?.[1];
    expect(ip.cameraPermission).toBe(false);
    expect(ip.microphonePermission).toBe(false);
  });
  it("no analytics/tracking plugins are configured", () => {
    const names = cfg.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    expect(names.filter((n: string) => /analytics|sentry|firebase|segment|amplitude|tracking/i.test(n))).toEqual([]);
  });
});
