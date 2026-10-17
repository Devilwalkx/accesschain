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
  /** Optional TfL application key; none is bundled. */
  tflAppKey?: string;
}

export type Start = { kind: "station"; id: string; name: string } | { kind: "here"; point: LatLng };

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
}

const NOM = "https://nominatim.openstreetmap.org/search";
const TFL = "https://api.tfl.gov.uk";

export class LiveClient {
  private cache = new Map<string, { at: number; value: { venue: VenueFacts | null; editedAt: string | null } }>();
  constructor(private readonly d: LiveDeps) {}

  private async getJson(url: string, requested: string[], extra: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
    requested.push(url);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.d.timeoutMs ?? 15_000);
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
      return { status: res.status, body };
    } catch {
      return { status: 0, body: null };
    } finally {
      clearTimeout(timer);
    }
  }

  async lookupVenue(v: Venue, requested: string[] = []): Promise<{ venue: VenueFacts | null; editedAt: string | null }> {
    const hit = this.cache.get(v.id);
    if (hit && this.d.now().getTime() - hit.at < 10 * 60_000) return hit.value;
    const url = `${NOM}?q=${encodeURIComponent(v.query)}&format=jsonv2&extratags=1&limit=3&viewbox=-0.25,51.60,0.10,51.40&bounded=1`;
    const r = await this.getJson(url, requested);
    const venue = parseNominatim(r.status, r.body, v.query);
    let editedAt: string | null = null;
    if (venue && this.d.allowOsmApi) {
      const e = await this.getJson(`https://api.openstreetmap.org/api/0.6/${venue.osmRef.type}/${venue.osmRef.id}.json`, requested);
      editedAt = parseOsmEditDate(e.status, e.body);
    }
    const value = { venue, editedAt };
    if (venue) this.cache.set(v.id, { at: this.d.now().getTime(), value });
    return value;
  }

  async liftOutages(requested: string[] = []): Promise<LiftOutages | null> {
    const r = await this.getJson(`${TFL}/Disruptions/Lifts/v2${this.key("?")}`, requested);
    return parseLiftFeed(r.status, r.body);
  }

  private key(sep: "?" | "&") {
    return this.d.tflAppKey ? `${sep}app_key=${encodeURIComponent(this.d.tflAppKey)}` : "";
  }

  async planTrip(venue: Venue, start: Start): Promise<TripResult> {
    const requested: string[] = [];
    const fetchedAt = this.d.now().toISOString();
    const notices: string[] = [];
    const base = { fetchedAt, requested, notices, venue: null as VenueFacts | null, venueEditedAt: null as string | null, routes: [] as RouteCandidate[], noStepFreeRoute: false, startNotRecognised: false };

    const found = await this.lookupVenue(venue, requested);
    if (!found.venue) {
      notices.push(`We couldn't find ${venue.name} just now. Please try again in a moment.`);
      return base;
    }
    base.venue = found.venue;
    base.venueEditedAt = found.editedAt;

    const from = start.kind === "station" ? start.id : (() => { const p = minimiseCoordinate(start.point); return `${p.lat},${p.lng}`; })();
    const to = `${found.venue.lat.toFixed(4)},${found.venue.lon.toFixed(4)}`;
    const jUrl = `${TFL}/Journey/JourneyResults/${from}/to/${to}?accessibilityPreference=StepFreeToVehicle,StepFreeToPlatform&walkingSpeed=Slow${this.key("&")}`;
    const [jr, lifts] = await Promise.all([this.getJson(jUrl, requested), this.liftOutages(requested)]);

    if (!lifts) notices.push("We couldn't load TfL's lift information, so lifts on the way are unchecked.");
    const parsed = parseJourneyResponse(jr.status, jr.body);
    if (parsed.kind === "no_journey") base.noStepFreeRoute = true;
    else if (parsed.kind === "ambiguous_start") base.startNotRecognised = true;
    else if (parsed.kind === "unusable") notices.push(jr.status === 0 ? "We couldn't reach TfL. Please check your connection and try again." : "TfL's journey information was not usable just now.");
    else {
      base.routes = parsed.journeys.slice(0, 3).map((j, i) =>
        journeyToRoute(j, { routeId: `trip-${i + 1}`, fetchedAt, stepFreeRequested: true, lifts, venue: found.venue, venueEditedAt: found.editedAt })
      );
    }
    return base;
  }
}

export function assessAll(routes: RouteCandidate[], profile: RequirementsProfile, nowIso: string): Array<{ route: RouteCandidate; assessment: JourneyAssessment }> {
  return routes.map((route) => ({ route, assessment: assessRoute(route, profile, nowIso) }));
}
