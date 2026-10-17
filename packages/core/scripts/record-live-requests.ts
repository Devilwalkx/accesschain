/**
 * Runs the app's OWN LiveClient (the same code and the same User-Agent builder as the Android app) once against the real services
 * and prints what was asked and what came back: status codes, the request headers sent, and the response headers that matter for the
 * services' policies (cache, rate limit). Nothing personal is involved: a fixed place and a fixed station. Informational (CI job live-smoke).
 */
import { LiveClient, STATIONS, VENUES, buildUserAgent } from "../src/index.js";

const KEEP = ["content-type", "cache-control", "expires", "etag", "age", "date", "retry-after", "server", "via", "cf-cache-status", "vary", "access-control-allow-origin"];
const log: string[] = [];
const client = new LiveClient({
  userAgent: buildUserAgent("0.2.0"),
  allowOsmApi: false,
  now: () => new Date(),
  fetch: async (url, init) => {
    const res = await fetch(url, { headers: init?.headers, signal: init?.signal });
    const h: Record<string, string> = {};
    res.headers.forEach((v, k) => { if (KEEP.includes(k) || /ratelimit|rate-limit|x-ms-|request-context/.test(k)) h[k] = v; });
    const text = await res.text();
    log.push(`GET ${url.replace(/\?.*/, "?…")}\n  status: ${res.status}\n  request headers sent: ${JSON.stringify(init?.headers)}\n  response headers: ${JSON.stringify(h)}\n  body bytes: ${text.length}`);
    return { status: res.status, json: async () => JSON.parse(text) };
  }
});

const venue = VENUES[0]!;
const st = STATIONS[1]!;
const t0 = Date.now();
const r = await client.planTrip(venue, { kind: "station", id: st.id, name: st.name });
console.log(`Place: ${venue.name}; start: ${st.name}; time ${Date.now() - t0} ms`);
console.log(log.join("\n"));
console.log("\nWhat the app would show:");
console.log(JSON.stringify({ sources: r.sources, routes: r.routes.map((x) => x.title), notices: r.notices, noStepFreeRoute: r.noStepFreeRoute, venue: r.venue && { name: r.venue.name, wheelchair: r.venue.wheelchair, hasNote: !!r.venue.description, phone: !!r.venue.phone, website: !!r.venue.website } }, null, 1));
