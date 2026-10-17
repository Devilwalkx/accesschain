import { z } from "zod";
import type { Observation, RouteCandidate, Segment, Source } from "../types.js";
import type { VenueFacts } from "./osm.js";
import { entranceSegment } from "./osm.js";

/**
 * Adapter for the TfL Unified API (api.tfl.gov.uk), written against responses recorded on 2026-10-17:
 *  - GET /Journey/JourneyResults/{from}/to/{to}?accessibilityPreference=StepFreeToVehicle,StepFreeToPlatform&walkingSpeed=Slow
 *  - GET /Disruptions/Lifts/v2  (lists ONLY lifts with problems; a station that is absent means "no problem reported")
 * Everything is validated; anything unexpected is dropped and becomes "insufficient evidence", never a pass.
 * Licence: TfL's Transport Data Service terms were read from an archived copy (the live page blocks automated readers); see docs/SERVICE_TERMS_AUDIT.md.
 */

const nul = <T extends z.ZodTypeAny>(t: T) => t.nullable().optional();

const PointSchema = z.object({
  commonName: nul(z.string()),
  naptanId: nul(z.string()),
  hubNaptanCode: nul(z.string()),
  icsCode: nul(z.string()),
  lat: nul(z.number()),
  lon: nul(z.number())
});

const LegSchema = z.object({
  mode: z.object({ id: z.string() }),
  distance: nul(z.number()),
  duration: nul(z.number()),
  isDisrupted: nul(z.boolean()),
  instruction: z.object({
    summary: z.string(),
    steps: z
      .array(z.object({ description: nul(z.string()), streetName: nul(z.string()), distance: nul(z.number()), turnDirection: nul(z.string()), trackType: nul(z.string()) }))
      .optional()
  }),
  departurePoint: nul(PointSchema),
  arrivalPoint: nul(PointSchema),
  obstacles: z.array(z.object({ type: z.string(), incline: nul(z.string()), position: nul(z.string()), stopId: nul(z.union([z.number(), z.string()])) })).optional(),
  disruptions: z.array(z.object({ category: nul(z.string()), description: nul(z.string()) })).optional()
});

const JourneySchema = z.object({
  startDateTime: nul(z.string()),
  arrivalDateTime: nul(z.string()),
  duration: nul(z.number()),
  legs: z.array(LegSchema).min(1)
});

export type TflJourney = z.infer<typeof JourneySchema>;

export type ParsedJourneys =
  | { kind: "journeys"; journeys: TflJourney[] }
  | { kind: "no_journey" }
  | { kind: "ambiguous_start" }
  | { kind: "unusable"; reason: string };

/** Interpret an HTTP status + body from the journey endpoint. 404 "No journey found" is an answer, not an error. */
export function parseJourneyResponse(status: number, body: unknown): ParsedJourneys {
  if (status === 404) {
    const msg = typeof (body as { message?: unknown })?.message === "string" ? (body as { message: string }).message : "";
    return /no journey found/i.test(msg) ? { kind: "no_journey" } : { kind: "unusable", reason: "TfL returned not found" };
  }
  if (status === 300) return { kind: "ambiguous_start" };
  if (status !== 200) return { kind: "unusable", reason: `TfL returned status ${status}` };
  const root = z.object({ journeys: z.array(z.unknown()) }).safeParse(body);
  if (!root.success) return { kind: "unusable", reason: "TfL response was not in the expected shape" };
  const journeys = root.data.journeys.flatMap((j) => {
    const p = JourneySchema.safeParse(j);
    return p.success ? [p.data] : [];
  });
  return journeys.length > 0 ? { kind: "journeys", journeys } : { kind: "no_journey" };
}

const LiftFeedSchema = z.array(z.object({ stationUniqueId: z.string(), disruptedLiftUniqueIds: z.array(z.string()).optional(), message: nul(z.string()) }));

/** Station id -> TfL's own outage messages. Only stations WITH a problem appear. */
export type LiftOutages = Record<string, string[]>;

export function parseLiftFeed(status: number, body: unknown): LiftOutages | null {
  if (status !== 200) return null;
  const p = LiftFeedSchema.safeParse(body);
  if (!p.success) return null;
  const out: LiftOutages = {};
  for (const e of p.data) (out[e.stationUniqueId] ??= []).push(e.message ?? "TfL reports a lift problem here.");
  return out;
}

const PLANNER: Source = { kind: "operator_feed", id: "tfl-journey-planner", verifierType: "operator", licence: "Powered by TfL Open Data (TfL Transport Data Service licence; see docs/SERVICE_TERMS_AUDIT.md)" };
const LIFTS: Source = { kind: "operator_feed", id: "tfl-lift-disruptions", verifierType: "operator", licence: "Powered by TfL Open Data (TfL Transport Data Service licence; see docs/SERVICE_TERMS_AUDIT.md)" };

/** Live data is only trusted briefly. */
export const LIVE_TTL_MS = 15 * 60 * 1000;

const iso = (ms: number) => new Date(ms).toISOString();
const TRANSIT_WORD: Record<string, string> = { tube: "Tube", "national-rail": "Train", dlr: "DLR", overground: "Overground", "elizabeth-line": "Elizabeth line", bus: "Bus", "river-bus": "Boat", tram: "Tram", "cable-car": "Cable car", coach: "Coach" };

function stationIds(p: z.infer<typeof PointSchema> | null | undefined): string[] {
  if (!p) return [];
  return [p.naptanId, p.hubNaptanCode].filter((x): x is string => !!x);
}

export interface RouteContext {
  routeId: string;
  fetchedAt: string;
  /** True if we asked TfL for step-free routing. */
  stepFreeRequested: boolean;
  /** null = the lift feed could not be loaded (so nothing is known about lift status). */
  lifts: LiftOutages | null;
  venue: VenueFacts | null;
  venueEditedAt: string | null;
}

/** Convert one TfL journey into the evidence model. Pavement/kerb facts are NOT claimed: TfL does not provide them. */
export function journeyToRoute(j: TflJourney, ctx: RouteContext): RouteCandidate {
  const fetched = Date.parse(ctx.fetchedAt);
  const expires = iso(fetched + LIVE_TTL_MS);
  const notes: string[] = [];
  const directions: string[] = [];
  let n = 0;
  const ob = (attribute: Observation["attribute"], value: Observation["value"], source: Source): Observation => ({
    id: `${ctx.routeId}-${(n += 1)}`,
    attribute,
    value,
    source,
    observedAt: ctx.fetchedAt,
    retrievedAt: ctx.fetchedAt,
    expiresAt: expires,
    status: "active"
  });

  const segments: Segment[] = j.legs.map((leg, i) => {
    const last = i === j.legs.length - 1;
    const walking = leg.mode.id === "walking";
    const kind: Segment["kind"] = walking ? (last ? "approach" : "transfer") : i === 0 ? "arrival" : "transfer";
    const observations: Observation[] = [];
    let usesLift = false;

    if (walking) {
      if (typeof leg.distance === "number" && leg.distance >= 0) observations.push(ob("walkLengthM", Math.round(leg.distance), PLANNER));
      const types = new Set((leg.obstacles ?? []).map((o) => o.type.toUpperCase()));
      if (types.has("STAIRS")) observations.push(ob("stepFree", false, PLANNER));
      if (types.has("LIFT")) {
        usesLift = true;
        if (ctx.lifts) {
          const stopIds = new Set((leg.obstacles ?? []).filter((o) => o.type.toUpperCase() === "LIFT").map((o) => String(o.stopId ?? "")));
          const pts = [leg.departurePoint, leg.arrivalPoint].filter((p): p is z.infer<typeof PointSchema> => !!p);
          const related = pts.filter((p) => p.icsCode && stopIds.has(String(p.icsCode)));
          const ids = (related.length > 0 ? related : pts).flatMap(stationIds);
          const outage = ids.find((id) => ctx.lifts![id]);
          if (outage) {
            observations.push(ob("liftInService", false, LIFTS));
            notes.push(...ctx.lifts[outage]!.map((m) => `TfL lift notice: ${m}`));
          } else {
            observations.push(ob("liftInService", true, LIFTS)); // means "no problem reported", worded that way in the UI
          }
        }
        // lift feed unavailable: no observation, so the matcher reports insufficient evidence
      }
      // No stepFree observation otherwise: TfL does not describe kerbs or pavement, so that stays unknown.
    } else if (ctx.stepFreeRequested && !leg.isDisrupted) {
      observations.push(ob("stepFree", true, PLANNER));
    }
    if (leg.isDisrupted) notes.push(`TfL reports a disruption: ${leg.instruction.summary}.`);
    for (const d of leg.disruptions ?? []) if (d.description) notes.push(`TfL notice: ${d.description}`);
    for (const s of leg.instruction.steps ?? []) if (s.description) directions.push(`${s.turnDirection && s.turnDirection !== "STRAIGHT" ? s.turnDirection.toLowerCase().replace(/_/g, " ") + ": " : ""}${s.description}`);

    const mode = TRANSIT_WORD[leg.mode.id] ?? leg.mode.id;
    return { id: `${ctx.routeId}-leg${i + 1}`, kind, label: walking ? leg.instruction.summary : `${mode}: ${leg.instruction.summary}`, usesLift, walking, observations };
  });

  segments.push(entranceSegment(ctx.venue, ctx.venueEditedAt, ctx.fetchedAt, `${ctx.routeId}-entrance`));

  const walkM = j.legs.filter((l) => l.mode.id === "walking").reduce((a, l) => a + (l.distance ?? 0), 0);
  const transit = j.legs.filter((l) => l.mode.id !== "walking").map((l) => TRANSIT_WORD[l.mode.id] ?? l.mode.id);
  const mins = j.duration ?? j.legs.reduce((a, l) => a + (l.duration ?? 0), 0);
  const title = transit.length === 0 ? `Walk about ${Math.round(walkM / 10) * 10} m (${mins} min)` : `${[...new Set(transit)].join(" + ")}, then walk about ${Math.round(walkM / 10) * 10} m (${mins} min)`;
  return { id: ctx.routeId, provider: "TfL journey planner", title, notes: [...new Set(notes)], directions, segments };
}
