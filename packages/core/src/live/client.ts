import { minimiseCoordinate, type LatLng } from "../privacy.js";
import { assessRoute } from "../match.js";
import type { RequirementsProfile } from "../profile.js";
import type { JourneyAssessment, RouteCandidate } from "../types.js";
import type { Venue } from "./places.js";
import { parseNominatim, parseOsmEditDate, type VenueFacts } from "./osm.js";
import { journeyToRoute, parseJourneyResponse, parseLiftFeed, type LiftOutages } from "./tfl.js";

/**
 * Live data client. It never receives the user's needs profile: requests contain only a start station id or a
 * rounded location, the venue's public coordinates and the venue name. Matching against needs happens on the device afterwards.
 */
export interface LiveDeps {
  fetch: (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;
  now: () => Date;
  /** Native apps should identify themselves to OpenStreetMap services. Browsers cannot set this header. */
  userAgent?: string;
  /** api.openstreetmap.org blocks browsers (no CORS), so the web build cannot read edit dates. */
  allowOsmApi: boolean;
  timeoutMs?: number;
  /** Waits; injectable so tests do not really wait. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Optional TfL application key; none is bundled. */
  tflAppKey?: string;
}

export type Start =
  | { kind: "station"; id: string; name: string }
  | { kind: "here"; point: LatLng }
  /** A UK postcode typed by the person. Sent to TfL as typed (TfL resolves it); never sent to OpenStreetMap. */
  | { kind: "postcode"; postcode: string };

const POSTCODE = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/;
/** "se19px" -> "SE1 9PX". Returns null if it is not shaped like a UK postcode (we never guess). */
export function normalisePostcode(input: string): string | null {
  const m = POSTCODE.exec(input.trim().toUpperCase().replace(/\s+/g, ""));
  return m ? `${m[1]} ${m[2]}` : null;
}

/** How one outside service answered. "unreachable" covers no connection, DNS and slow-network timeouts, which cannot be told apart reliably. */
export type SourceState = "ok" | "unavailable" | "unreachable" | "slow" | "skipped" | "not_found";
export interface SourceReport {
  state: SourceState;
  /** ISO time the service was last asked (for "checked N minutes ago"). For a cached place lookup this is when it was really fetched. */
  at: string;
}

export interface TripResult {
  fetchedAt: string;
  venue: VenueFacts | null;
  venueEditedAt: string | null;
  routes: RouteCandidate[];
  /** TfL answered that it has no step-free journey. */
  noStepFreeRoute: boolean;
  /** True if the start was not recognised by TfL. */
  startNotRecognised: boolean;
  /** Plain-English problems that apply to the whole trip (never silent). */
  notices: string[];
  /** URLs requested, for the privacy test and the "what was sent" screen. */
  requested: string[];
  /** Per service: did it answer, and when was it asked. Lets the screen say "TfL answered, OpenStreetMap did not". */
  sources: { place: SourceReport; route: SourceReport; lifts: SourceReport };
  /** The start point TfL actually used (its own name for it), so a typed start can be confirmed by the person. */
  startUsedName: string | null;
  /** For a typed postcode: TfL used a different place than the one typed. The screen must say so. */
  startMismatch: boolean;
}

const NOM = "https://nominatim.openstreetmap.org/search";
const TFL = "https://api.tfl.gov.uk";
/** Nominatim usage policy: absolute maximum of 1 request per second (see docs/SERVICE_TERMS_AUDIT.md). */
export const NOMINATIM_MIN_GAP_MS = 1100;
/** Place lookups are cached so the same query is not sent repeatedly (Nominatim policy). */
export const PLACE_CACHE_MS = 30 * 60_000;
export const NOT_FOUND_CACHE_MS = 10 * 60_000;

type Raw = { status: number; body: unknown; failure: "none" | "network" | "timeout" };
type PlaceValue = { venue: VenueFacts | null; editedAt: string | null; at: string; state: SourceState };

export class LiveClient {
  private cache = new Map<string, { at: number; ttl: number; value: PlaceValue }>();
  private inflight = new Map<string, Promise<TripResult>>();
  private lastNominatim = Number.NEGATIVE_INFINITY;
  constructor(private readonly d: LiveDeps) {}

  private async getJson(url: string, requested: string[], extra: Record<string, string> = {}): Promise<Raw> {
    requested.push(url);
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, this.d.timeoutMs ?? 15_000);
    try {
      const headers: Record<string, string> = { Accept: "application/json", ...extra };
      if (this.d.userAgent) headers["User-Agent"] = this.d.userAgent;
      const res = await this.d.fetch(url, { headers, signal: ctl.signal });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body, failure: "none" };
    } catch {
      return { status: 0, body: null, failure: timedOut ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  private stateOf(r: Raw, okStatuses: number[] = [200]): SourceState {
    if (r.failure === "timeout") return "slow";
    if (r.failure === "network") return "unreachable";
    return okStatuses.includes(r.status) ? "ok" : "unavailable";
  }

  private async nominatimGate(): Promise<void> {
    const wait = this.lastNominatim + NOMINATIM_MIN_GAP_MS - this.d.now().getTime();
    this.lastNominatim = this.d.now().getTime() + Math.max(0, wait);
    if (wait > 0) await (this.d.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(wait);
  }

  async lookupVenue(v: Venue, requested: string[] = []): Promise<PlaceValue> {
    const hit = this.cache.get(v.id);
    if (hit && this.d.now().getTime() - hit.at < hit.ttl) return hit.value;
    await this.nominatimGate();
    const url = `${NOM}?q=${encodeURIComponent(v.query)}&format=jsonv2&extratags=1&limit=3&viewbox=-0.25,51.60,0.10,51.40&bounded=1`;
    const r = await this.getJson(url, requested);
    const at = this.d.now().toISOString();
    const venue = parseNominatim(r.status, r.body, v.query);
    let editedAt: string | null = null;
    if (venue && this.d.allowOsmApi) {
      // Off by default: OSM's API usage policy says the editing API is not for read-only use (docs/SERVICE_TERMS_AUDIT.md).
      const e = await this.getJson(`https://api.openstreetmap.org/api/0.6/${venue.osmRef.type}/${venue.osmRef.id}.json`, requested);
      editedAt = parseOsmEditDate(e.status, e.body);
    }
    const state: SourceState = venue ? "ok" : r.failure !== "none" || r.status !== 200 ? this.stateOf(r) : "not_found";
    const value: PlaceValue = { venue, editedAt, at, state };
    if (venue) this.cache.set(v.id, { at: this.d.now().getTime(), ttl: PLACE_CACHE_MS, value });
    else if (state === "not_found") this.cache.set(v.id, { at: this.d.now().getTime(), ttl: NOT_FOUND_CACHE_MS, value });
    return value;
  }

  async liftOutages(requested: string[] = []): Promise<{ lifts: LiftOutages | null; state: SourceState }> {
    const r = await this.getJson(`${TFL}/Disruptions/Lifts/v2${this.key("?")}`, requested);
    const lifts = parseLiftFeed(r.status, r.body);
    return { lifts, state: lifts ? "ok" : r.failure !== "none" ? this.stateOf(r) : "unavailable" };
  }

  private key(sep: "?" | "&") {
    return this.d.tflAppKey ? `${sep}app_key=${encodeURIComponent(this.d.tflAppKey)}` : "";
  }

  /**
   * Plans a trip. Never throws, and two identical requests made while one is still running share the same answer
   * (so a double tap or an impatient retry cannot send a duplicate request).
   */
  planTrip(venue: Venue, start: Start): Promise<TripResult> {
    const key = `${venue.id}|${start.kind === "station" ? start.id : start.kind === "postcode" ? start.postcode : (() => { const p = minimiseCoordinate(start.point); return `${p.lat},${p.lng}`; })()}`;
    const running = this.inflight.get(key);
    if (running) return running;
    const p = this.planTripOnce(venue, start)
      .catch((): TripResult => this.empty(["Something went wrong while checking. Nothing has been assumed. Please try again."]))
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private empty(notices: string[]): TripResult {
    let at: string;
    try { at = this.d.now().toISOString(); } catch { at = new Date().toISOString(); }
    const none: SourceReport = { state: "skipped", at };
    return { fetchedAt: at, venue: null, venueEditedAt: null, routes: [], noStepFreeRoute: false, startNotRecognised: false, notices, requested: [], sources: { place: none, route: none, lifts: none }, startUsedName: null, startMismatch: false };
  }

  private async planTripOnce(venue: Venue, start: Start): Promise<TripResult> {
    const requested: string[] = [];
    const fetchedAt = this.d.now().toISOString();
    const base = this.empty([]);
    base.fetchedAt = fetchedAt;
    base.requested = requested;
    const notices = base.notices;

    let from: string;
    if (start.kind === "postcode") {
      const pc = normalisePostcode(start.postcode);
      if (!pc) {
        notices.push("That does not look like a UK postcode. Please check it, or choose a station.");
        return base;
      }
      from = encodeURIComponent(pc);
    } else if (start.kind === "station") {
      from = start.id;
    } else {
      const p = minimiseCoordinate(start.point);
      from = `${p.lat},${p.lng}`;
    }

    const found = await this.lookupVenue(venue, requested);
    base.sources.place = { state: found.state, at: found.at };
    if (!found.venue) {
      notices.push(
        found.state === "not_found"
          ? `OpenStreetMap has no match for ${venue.name} just now.`
          : found.state === "unreachable" || found.state === "slow"
            ? `We couldn't reach OpenStreetMap to find ${venue.name}. Please check your connection and try again.`
            : `We couldn't find ${venue.name} just now. Please try again in a moment.`
      );
      return base;
    }
    base.venue = found.venue;
    base.venueEditedAt = found.editedAt;

    const to = `${found.venue.lat.toFixed(4)},${found.venue.lon.toFixed(4)}`;
    const jUrl = `${TFL}/Journey/JourneyResults/${from}/to/${to}?accessibilityPreference=StepFreeToVehicle,StepFreeToPlatform&walkingSpeed=Slow${this.key("&")}`;
    const [jr, liftRes] = await Promise.all([this.getJson(jUrl, requested), this.liftOutages(requested)]);
    const lifts = liftRes.lifts;
    const asked = this.d.now().toISOString();
    base.sources.lifts = { state: liftRes.state, at: asked };

    if (!lifts) notices.push("We couldn't load TfL's lift information, so lifts on the way are unchecked.");
    const parsed = parseJourneyResponse(jr.status, jr.body);
    base.sources.route = { state: parsed.kind === "unusable" ? this.stateOf(jr) : "ok", at: asked };
    if (parsed.kind === "no_journey") base.noStepFreeRoute = true;
    else if (parsed.kind === "ambiguous_start") base.startNotRecognised = true;
    else if (parsed.kind === "unusable") {
      notices.push(
        jr.failure === "timeout" ? "TfL was too slow to answer. Please try again in a moment."
        : jr.status === 0 ? "We couldn't reach TfL. Please check your connection and try again."
        : "TfL's journey information was not usable just now."
      );
    } else {
      base.routes = parsed.journeys.slice(0, 3).map((j, i) =>
        journeyToRoute(j, { routeId: `trip-${i + 1}`, fetchedAt, stepFreeRequested: true, lifts, venue: found.venue, venueEditedAt: found.editedAt })
      );
      const used = parsed.journeys[0]?.legs[0]?.departurePoint?.commonName ?? null;
      base.startUsedName = used;
      if (start.kind === "postcode" && used) {
        const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");
        base.startMismatch = norm(used) !== norm(normalisePostcode(start.postcode) ?? "");
      }
    }
    return base;
  }
}
export function assessAll(routes: RouteCandidate[], profile: RequirementsProfile, nowIso: string): Array<{ route: RouteCandidate; assessment: JourneyAssessment }> {
  return routes.map((route) => ({ route, assessment: assessRoute(route, profile, nowIso) }));
}
