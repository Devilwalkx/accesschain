import { resolveAttribute } from "../evidence.js";
import type { RequirementsProfile } from "../profile.js";
import type { AttributeKey, JourneyAssessment, Reason, RouteCandidate, Segment, Verdict } from "../types.js";
import { communityDate, monthYear, type VenueFacts } from "./osm.js";

/**
 * The journey as four separate parts, each saying what is known, what is missing, how old the information is and what the
 * person can do next. Pure text built from the evidence model: nothing here invents a pavement, a crossing, a phone number or a route.
 * A "next step" is only produced from data that is really present (an OpenStreetMap link, a contact detail OpenStreetMap lists,
 * or another route in the same result whose evidence is better).
 */
export type PartId = "transport" | "transfers" | "approach" | "entrance";
export type PartStatus = "confirmed" | "problem" | "unconfirmed" | "not_needed" | "no_requirement" | "not_checked";

export interface NextStep {
  kind: "inspect" | "contact" | "compare" | "recheck" | "none";
  text: string;
  phone?: string;
  url?: string;
}

export interface PartBrief {
  id: PartId;
  title: string;
  /** What this part of the journey is, in plain words. */
  about: string;
  status: PartStatus;
  statusText: string;
  /** The legs of the journey that belong to this part, as the data source describes them. */
  legs: string[];
  known: string[];
  missing: string[];
  /** How old the information is, in words. */
  age: string;
  nextSteps: NextStep[];
}

export interface RouteBrief {
  routeId: string;
  title: string;
  verdict: Verdict | "not_checked";
  headline: string;
  parts: PartBrief[];
}

export interface BriefContext {
  nowIso: string;
  /** True for live TfL/OpenStreetMap data; false for the made-up demonstration. */
  live: boolean;
  venue: VenueFacts | null;
  venueEditedAt: string | null;
  /** Display name of the destination. */
  venueName: string;
  /** TfL's lift list could not be loaded. */
  liftsUnavailable?: boolean;
}

const TITLES: Record<PartId, string> = { transport: "Transport", transfers: "Transfers", approach: "Final approach", entrance: "Correct entrance" };
const ABOUT: Record<PartId, string> = {
  transport: "The train, tube or bus legs.",
  transfers: "Walking and lifts between stops, platforms and the street.",
  approach: "The last walk from the stop to the place.",
  entrance: "The entrance you would use at the place."
};

const MIN = 60_000;
/** "just now", "5 minutes ago", "3 hours ago", "4 days ago", "7 months ago", "2 years ago". */
export function ageText(iso: string, nowIso: string): string {
  const diff = Date.parse(nowIso) - Date.parse(iso);
  if (!Number.isFinite(diff)) return "unknown age";
  if (diff < 90_000) return "just now";
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"} ago`;
  if (diff < 60 * MIN) return plural(Math.round(diff / MIN), "minute");
  if (diff < 48 * 60 * MIN) return plural(Math.round(diff / (60 * MIN)), "hour");
  const days = diff / (24 * 60 * MIN);
  if (days < 60) return plural(Math.round(days), "day");
  if (days < 730) return plural(Math.round(days / 30.44), "month");
  return plural(Math.round(days / 365.25), "year");
}

/** Short plain list of what the person asked for, shown at the top of the result. */
export function describeNeeds(p: RequirementsProfile): string[] {
  const out: string[] = [];
  out.push(p.avoidSteps ? "No steps" : "Steps are fine");
  out.push(p.liftAcceptable ? "Lifts are fine" : "No lifts");
  if (p.assistanceAcceptable) out.push("Help at the door is fine");
  if (p.needsAccessibleToilet) out.push("Accessible toilet");
  if (p.maxWalkM !== undefined) out.push(`Walk up to ${p.maxWalkM} m`);
  if (p.minClearWidthMm !== undefined) out.push(`Doorway at least ${p.minClearWidthMm} mm`);
  if (p.maxRestGapM !== undefined) out.push(`Rest every ${p.maxRestGapM} m or less`);
  return out;
}

function partOf(seg: Segment): PartId {
  if (seg.kind === "entrance") return "entrance";
  if (seg.kind === "approach") return "approach";
  if (!seg.walking) return "transport";
  return "transfers";
}

const REQ_MISSING: Record<string, Record<PartId, string> | string> = {
  "avoid steps": {
    transport: "Whether this leg is step-free",
    transfers: "Whether there are steps on the walk between stops",
    approach: "Whether there are steps or kerbs on this walk",
    entrance: "Whether the entrance has steps"
  },
  lift: "Whether the lift is working",
  "clear width": "How wide the doorway or passage is",
  "resting points": "Where you could rest on the way",
  "accessible toilet": "Whether there is an accessible toilet"
};

function missingFor(r: Reason, part: PartId): string | null {
  if (r.requirement === "walking distance" || r.requirement === "journey completeness" || r.requirement === "none set") return null;
  const m = REQ_MISSING[r.requirement];
  if (!m) return null;
  return typeof m === "string" ? m : m[part];
}

/** Plain name of where a fact came from. Internal ids are never shown to the person. */
const who = (src: { id: string; kind: string }) =>
  src.id.startsWith("tfl-") ? "TfL"
  : src.id === "openstreetmap-contributors" ? "OpenStreetMap contributors"
  : src.kind === "field_verification" ? "A field check"
  : src.kind === "venue_report" ? "The venue"
  : src.kind === "operator_feed" ? "The transport operator"
  : src.kind === "user_report" ? "Other travellers"
  : "A reported source";

function factLines(seg: Segment, part: PartId, nowIso: string): { known: string[]; missing: string[] } {
  const known: string[] = [];
  const missing: string[] = [];
  const attrs = [...new Set(seg.observations.filter((o) => o.status === "active").map((o) => o.attribute))] as AttributeKey[];
  for (const a of attrs) {
    const res = resolveAttribute(seg, a, nowIso);
    const src = who((res.state === "known" || res.state === "conflict" ? res.basis : res.state === "stale" ? res.lastKnown : [])[0]?.source ?? { id: "unknown", kind: "" });
    if (res.state === "stale") {
      missing.push(`Out of date: ${label(a)} (it has expired, so it is not counted).`);
      continue;
    }
    if (res.state === "conflict") {
      missing.push(`Sources disagree about ${label(a)}.`);
      continue;
    }
    if (res.state !== "known") continue;
    const v = res.value;
    switch (a) {
      case "stepFree":
        if (part === "entrance") known.push(v ? `${src}: the place is wheelchair accessible.` : `${src}: the place is not wheelchair accessible.`);
        else if (v) known.push(`${src}: this leg is planned step-free to and from the vehicle.`);
        else known.push(seg.walking ? `${src}: stairs are reported on this walk.` : `${src}: steps are reported here.`);
        break;
      case "walkLengthM": known.push(`Walk of about ${v} m (${src}).`); break;
      case "liftInService": known.push(v ? `${src}: no problem is reported with the lift.` : `${src}: the lift is reported out of service.`); break;
      case "accessibleToilet": known.push(v ? `${src}: there is an accessible toilet.` : `${src}: there is no accessible toilet.`); break;
      case "clearWidthMm": known.push(`Clear width ${v} mm (${src}).`); break;
      case "restingPointSpacingM": known.push(`Somewhere to rest about every ${v} m (${src}).`); break;
      case "assistanceAvailable": known.push(v ? "Help is reported as available, and has to be arranged." : "No help is reported as available."); break;
    }
  }
  return { known, missing };
}

function label(a: AttributeKey): string {
  return ({
    stepFree: "steps", clearWidthMm: "doorway width", walkLengthM: "walking distance", restingPointSpacingM: "resting places",
    accessibleToilet: "the accessible toilet", liftInService: "the lift", assistanceAvailable: "help"
  } as Record<AttributeKey, string>)[a];
}

function ageFor(part: PartId, segs: Segment[], c: BriefContext): string {
  if (part === "entrance" && c.live && c.venue) {
    const { date, kind } = communityDate(c.venue, c.venueEditedAt);
    return date ? `${kind === "checked" ? "Checked" : "Last edited"} ${monthYear(date)} (${ageText(date, c.nowIso)}), by OpenStreetMap contributors.` : "No date, so we cannot say how old the place information is.";
  }
  const obs = segs.flatMap((s) => s.observations).filter((o) => o.status === "active");
  if (obs.length === 0) return "No information, so there is no date.";
  if (c.live) {
    const newest = obs.map((o) => o.retrievedAt).sort().at(-1)!;
    return `Asked TfL ${ageText(newest, c.nowIso)}. TfL information is only trusted for 15 minutes.`;
  }
  const oldest = obs.map((o) => o.observedAt).sort()[0]!;
  return `Demonstration information, dated ${ageText(oldest, c.nowIso)}.`;
}

const rank = (s: PartStatus) => (s === "problem" ? 3 : s === "unconfirmed" ? 2 : s === "confirmed" ? 1 : 0);

function statusFor(reasons: Reason[], hasSegments: boolean, hasAssessment: boolean): PartStatus {
  if (!hasSegments) return "unconfirmed";
  if (!hasAssessment) return "not_checked";
  if (reasons.some((r) => r.verdict === "known_barrier")) return "problem";
  if (reasons.some((r) => r.verdict === "insufficient_evidence")) return "unconfirmed";
  if (reasons.length === 0) return "no_requirement";
  return "confirmed";
}

const STATUS_TEXT: Record<PartStatus, string> = {
  confirmed: "Confirmed for your needs",
  problem: "A problem for your needs",
  unconfirmed: "Not confirmed",
  not_needed: "Not needed on this route",
  no_requirement: "Nothing in your needs applies here",
  not_checked: "Not checked against your needs"
};

function contactSteps(c: BriefContext): NextStep[] {
  const v = c.venue;
  if (!c.live) return [{ kind: "none", text: "The demonstration places have no contact details." }];
  if (!v) return [];
  const out: NextStep[] = [];
  if (v.phone) out.push({ kind: "contact", text: `Phone ${v.name} and ask about step-free entry. This number is listed on OpenStreetMap by contributors; we have not checked it: ${v.phone}`, phone: v.phone });
  if (v.website) out.push({ kind: "contact", text: `Look for access information on the website that OpenStreetMap lists for ${v.name} (not checked by us).`, url: v.website });
  if (out.length === 0) out.push({ kind: "none", text: `OpenStreetMap lists no phone number or website for ${v.name}, so we cannot suggest one.` });
  return out;
}

export function osmUrl(v: VenueFacts): string {
  return `https://www.openstreetmap.org/${v.osmRef.type}/${v.osmRef.id}`;
}

export function buildBriefs(routes: RouteCandidate[], assessments: Array<JourneyAssessment | null>, c: BriefContext): RouteBrief[] {
  const briefs: RouteBrief[] = routes.map((route, i) => {
    const a = assessments[i] ?? null;
    const parts: PartBrief[] = (["transport", "transfers", "approach", "entrance"] as PartId[]).map((id) => {
      const segs = route.segments.filter((s) => partOf(s) === id);
      const ids = new Set(segs.map((s) => s.id));
      const reasons = (a?.reasons ?? []).filter((r) => ids.has(r.segmentId) || (id === "approach" && r.requirement === "walking distance"));
      const known: string[] = [];
      let missing: string[] = [];
      for (const s of segs) {
        const f = factLines(s, id, c.nowIso);
        known.push(...f.known);
        missing.push(...f.missing);
      }
      for (const r of reasons) {
        if (r.verdict === "known_barrier" && r.requirement !== "walking distance") known.push(r.detail);
        if (r.verdict === "known_barrier" && r.requirement === "walking distance") known.push(r.detail);
        if (r.verdict === "insufficient_evidence") {
          const m = missingFor(r, id);
          if (m) missing.push(m);
          if (r.requirement === "walking distance") missing.push("The total distance you would walk");
        }
        if (r.verdict === "known_fit" && r.requirement === "walking distance") known.push(r.detail);
      }
      let status: PartStatus;
      if (segs.length === 0 && (id === "transport" || id === "transfers")) {
        status = "not_needed";
        known.push(id === "transport" ? "No train, tube or bus is needed on this route." : "No walking between stops or lifts is described for this route.");
      } else {
        status = statusFor(reasons, segs.length > 0, !!a);
        if (segs.length === 0) missing.push("This part of the journey is not described by the information source.");
      }
      if (c.live && id === "approach" && segs.length > 0 && !segs.some((s) => s.observations.some((o) => o.attribute === "stepFree"))) {
        missing.push("Pavements, kerbs and crossings: TfL does not describe them and nobody has recorded them here.");
      }
      if (c.liftsUnavailable && id === "transfers" && segs.some((s) => s.usesLift)) missing.push("Lift status (TfL's lift list could not be loaded).");
      if (id === "entrance" && c.live && c.venue) {
        if (c.venue.wheelchair === "limited") known.push("Contributors say the place is only partly accessible (this is shown in words and is not counted as a yes).");
        if (c.venue.description) known.push(`Contributor note: “${c.venue.description}”`);
        if (c.venue.wheelchair === "unknown") missing.push("Nobody has entered accessibility information for this place yet.");
        if (!communityDate(c.venue, c.venueEditedAt).date && (c.venue.wheelchair === "yes" || c.venue.wheelchair === "no")) missing.push("The community note has no date, so it is not counted as checked.");
      }
      if (id === "entrance" && c.live && !c.venue) missing.push("The place could not be looked up.");
      missing = [...new Set(missing)];

      const next: NextStep[] = [];
      if (c.live && c.venue && (id === "entrance" || id === "approach") && status !== "not_needed") {
        next.push({ kind: "inspect", text: `Read what contributors have written about ${c.venue.name} on OpenStreetMap.`, url: osmUrl(c.venue) });
      }
      if ((id === "entrance" || id === "approach") && status !== "confirmed" && status !== "not_needed") {
        const contact = contactSteps(c);
        if (id === "entrance") next.push(...contact);
        else if (contact.some((s) => s.kind !== "none")) next.push({ kind: "contact", text: `Ask ${c.venueName} how to get from the stop to the entrance without steps. Contact details are under “${TITLES.entrance}”.` });
        else if (c.live) next.push({ kind: "none", text: "No contact details are listed for this place, so we cannot suggest who to ask." });
      }
      if (id === "entrance" && status === "confirmed") next.push(...contactSteps(c).filter((x) => x.kind !== "none"));
      if (c.live && (id === "transport" || id === "transfers") && (status === "unconfirmed" || status === "problem") && segs.length > 0) {
        next.push({ kind: "recheck", text: id === "transfers" && c.liftsUnavailable ? "Try again in a few minutes: TfL's lift list could not be loaded." : "Check again just before you leave. TfL's information is only trusted for 15 minutes." });
      }
      return { id, title: TITLES[id], about: ABOUT[id], status, statusText: STATUS_TEXT[status], legs: segs.map((s) => s.label), known, missing, age: status === "not_needed" ? "Nothing to date: this part is not needed." : ageFor(id, segs, c), nextSteps: next };
    });

    const problems = parts.filter((p) => p.status === "problem").map((p) => p.title);
    const applicable = parts.filter((p) => p.status !== "not_needed");
    const confirmed = applicable.filter((p) => p.status === "confirmed" || p.status === "no_requirement").length;
    const headline = !a
      ? "Your needs are not set, so nothing was checked against them."
      : problems.length > 0
        ? `A problem was found: ${problems.join(", ")}.`
        : confirmed === applicable.length
          ? "Every part was confirmed for your needs by the information we have."
          : `${confirmed} of ${applicable.length} parts confirmed. Not confirmed: ${applicable.filter((p) => p.status === "unconfirmed" || p.status === "not_checked").map((p) => p.title).join(", ")}.`;
    return { routeId: route.id, title: route.title ?? route.id, verdict: a ? a.verdict : "not_checked", headline, parts };
  });

  // Second pass: point to another route in this same result whose evidence for that part is better.
  briefs.forEach((b, i) => {
    b.parts.forEach((p, k) => {
      if (p.status !== "problem" && p.status !== "unconfirmed") return;
      const better = briefs.find((o, j) => j !== i && rank(o.parts[k]!.status) > 0 && rank(o.parts[k]!.status) < rank(p.status));
      if (better) p.nextSteps.push({ kind: "compare", text: `Compare with “${better.title}”: ${p.title.toLowerCase()} is in better shape there (${better.parts[k]!.statusText.toLowerCase()}).` });
    });
  });
  return briefs;
}

/** The whole result as plain text, in reading order. For screen readers, copying, and as the single "text itinerary" view. */
export function briefToText(b: RouteBrief): string {
  const lines: string[] = [`${b.title}.`, b.headline];
  for (const p of b.parts) {
    lines.push("", `${p.title}: ${p.statusText}.`);
    for (const l of p.legs) lines.push(`  Leg: ${l}`);
    for (const k of p.known) lines.push(`  Known: ${k}`);
    for (const m of p.missing) lines.push(`  Missing: ${m}`);
    lines.push(`  Age of the information: ${p.age}`);
    for (const n of p.nextSteps) lines.push(`  What you can do: ${n.text}`);
  }
  lines.push("", "This is a summary of reported information, not a guarantee. Please confirm with the venue before you travel.");
  return lines.join("\n");
}
