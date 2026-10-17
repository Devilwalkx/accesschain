import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Use the pre-installed Chromium when present (sandbox); CI installs its own via `playwright install`.
const local = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync(local) ? local : undefined);
// AccessChain owns 4391 (dev Metro 8391). ScopeLock 4401, ScamCircle 4411, IngredientAlert 4421, CareRelay 4431.
const PORT = process.env.E2E_PORT ?? "4391";
const DIST = process.env.E2E_DIST ?? "../apps/mobile/dist-web";
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "tests",
  timeout: 240_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "off", launchOptions },
  webServer: {
    command: `npx serve ${DIST} -l ${PORT} -s --no-clipboard`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000
  },
  projects: [
    { name: "android-phone", use: { ...devices["Pixel 7"], launchOptions } },
    { name: "iphone-size", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices["iPhone 14"].userAgent, launchOptions } },
    { name: "small-phone", use: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions } }
  ]
});
