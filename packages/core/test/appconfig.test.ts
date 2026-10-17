import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cfg = JSON.parse(readFileSync(new URL("../../../apps/mobile/app.json", import.meta.url), "utf8")).expo;

describe("mobile app config (permissions minimised; verified once by `expo prebuild`)", () => {
  it("Android blocks background/fine location, microphone, camera, broad storage, overlay and vibrate permissions", () => {
    for (const p of ["ACCESS_BACKGROUND_LOCATION", "ACCESS_FINE_LOCATION", "RECORD_AUDIO", "CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "SYSTEM_ALERT_WINDOW", "VIBRATE", "USE_BIOMETRIC", "USE_FINGERPRINT", "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE"]) {
      expect(cfg.android.blockedPermissions).toContain(p);
    }
    expect(cfg.android.permissions).toEqual(["ACCESS_COARSE_LOCATION"]);
    // INTERNET is deliberately NOT blocked: live TfL / OpenStreetMap data needs it (docs/PERMISSIONS.md).
    expect(cfg.android.blockedPermissions).not.toContain("INTERNET");
  });
  it("has its own application id, version 0.2.0, no cloud backup and predictive back", () => {
    expect(cfg.android.package).toBe("app.devilwalkx.accesschain");
    expect(cfg.ios.bundleIdentifier).toBe("app.devilwalkx.accesschain");
    expect(cfg.version).toBe("0.2.0");
    expect(cfg.android.allowBackup).toBe(false);
    expect(cfg.android.predictiveBackGestureEnabled).toBe(true);
    expect(JSON.stringify(cfg)).not.toMatch(/invalid\.placeholder/);
  });
  it("the web export is stamped with the application id so an end-to-end test cannot talk to another app", () => {
    const post = readFileSync(new URL("../../../apps/mobile/scripts/postweb.mjs", import.meta.url), "utf8");
    expect(post).toContain('<meta name="application-id" content="app.devilwalkx.accesschain" />');
  });
  it("dedicated ports: end-to-end 4391 and Metro 8391, never reusing a running server", () => {
    const pw = readFileSync(new URL("../../../e2e/playwright.config.ts", import.meta.url), "utf8");
    expect(pw).toContain('"4391"');
    expect(pw).toContain("reuseExistingServer: false");
    const pkg = JSON.parse(readFileSync(new URL("../../../apps/mobile/package.json", import.meta.url), "utf8"));
    expect(pkg.scripts.start).toContain("8391");
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
