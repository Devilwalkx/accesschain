import { z } from "zod";
import type { Observation, Segment, Source } from "../types.js";

/**
 * Adapter for OpenStreetMap place data, written against responses recorded on 2026-10-17:
 *  - Nominatim search (extratags=1) gives wheelchair tags, e.g. wheelchair=yes|limited|no and wheelchair:description
 *  - The OSM API gives the object's last-edit timestamp (CORS-blocked in browsers, so the web build has no edit dates)
 * This is COMMUNITY information, never verified by us, and often old. It counts as evidence only if it has a date
 * (check_date or last edit) and is less than two years old; otherwise it is shown but treated as unknown.
 * Data is fetched live and never bundled (ODbL: attribution required; we do not redistribute extracts).
 */
export const COMMUNITY_SOURCE: Source = { kind: "user_report", id: "openstreetmap-contributors", verifierType: "none" };
export const COMMUNITY_TTL_DAYS = 730;

const NominatimItem = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  osm_type: z.enum(["node", "way", "relation"]),
  osm_id: z.number(),
  lat: z.string(),
  lon: z.string(),
  extratags: z.record(z.string(), z.string()).nullable().optional()
});

export type Wheelchair = "yes" | "limited" | "no" | "unknown";

export interface VenueFacts {
  name: string;
  lat: number;
  lon: number;
  osmRef: { type: "node" | "way" | "relation"; id: number };
  wheelchair: Wheelchair;
  description: string | null;
  toiletWheelchair: "yes" | "no" | "unknown";
  /** A real check date from the tags, if any ("YYYY-MM-DD"). */
  checkDate: string | null;
}

const clean = (s: string | undefined) => (s ? s.replace(/\s+/g, " ").trim().slice(0, 300) : null);

export function parseNominatim(status: number, body: unknown, query: string): VenueFacts | null {
  if (status !== 200 || !Array.isArray(body)) return null;
  const items = body.flatMap((b) => {
    const p = NominatimItem.safeParse(b);
    return p.success ? [p.data] : [];
  });
  if (items.length === 0) return null;
  const q = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const match = items.find((i) => i.name && q.includes((i.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()))) ?? items[0]!;
  const lat = Number(match.lat);
  const lon = Number(match.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const t = match.extratags ?? {};
  const wc = t["wheelchair"];
  const tw = t["toilets:wheelchair"];
  const cd = t["check_date:wheelchair"] ?? t["check_date"];
  return {
    name: match.name ?? query,
    lat,
    lon,
    osmRef: { type: match.osm_type, id: match.osm_id },
    wheelchair: wc === "yes" || wc === "limited" || wc === "no" ? wc : "unknown",
    description: clean(t["wheelchair:description"]),
    toiletWheelchair: tw === "yes" || tw === "no" ? tw : "unknown",
    checkDate: cd && /^\d{4}-\d{2}-\d{2}$/.test(cd) ? cd : null
  };
}

const OsmApi = z.object({ elements: z.array(z.object({ timestamp: z.string() })).min(1) });

/** Last-edit timestamp of the OSM object, or null. */
export function parseOsmEditDate(status: number, body: unknown): string | null {
  if (status !== 200) return null;
  const p = OsmApi.safeParse(body);
  if (!p.success) return null;
  const t = p.data.elements[0]!.timestamp;
  return Number.isNaN(Date.parse(t)) ? null : t;
}

export type DateKind = "checked" | "edited" | "none";

/** The date we rely on for freshness, and what kind of date it is. */
export function communityDate(v: VenueFacts, editedAt: string | null): { date: string | null; kind: DateKind } {
  if (v.checkDate) return { date: `${v.checkDate}T00:00:00Z`, kind: "checked" };
  if (editedAt) return { date: editedAt, kind: "edited" };
  return { date: null, kind: "none" };
}

/**
 * The venue entrance as a segment. Observations exist only when a date exists, and only for tags that give a clear answer:
 * wheelchair=yes -> step-free; wheelchair=no -> not step-free; "limited" gives NO answer (shown in words only).
 */
export function entranceSegment(v: VenueFacts | null, editedAt: string | null, fetchedAt: string, id: string): Segment {
  const seg: Segment = { id, kind: "entrance", label: v ? `${v.name}: entrance` : "The entrance", walking: false, observations: [] };
  if (!v) return seg;
  const { date } = communityDate(v, editedAt);
  if (!date) return seg;
  const observedMs = Math.min(Date.parse(date), Date.parse(fetchedAt));
  const base = (n: number, attribute: Observation["attribute"], value: Observation["value"]): Observation => ({
    id: `${id}-${n}`,
    attribute,
    value,
    source: COMMUNITY_SOURCE,
    observedAt: new Date(observedMs).toISOString(),
    retrievedAt: fetchedAt,
    expiresAt: new Date(observedMs + COMMUNITY_TTL_DAYS * 86_400_000).toISOString(),
    status: "active"
  });
  if (v.wheelchair === "yes") seg.observations.push(base(1, "stepFree", true));
  if (v.wheelchair === "no") seg.observations.push(base(1, "stepFree", false));
  if (v.toiletWheelchair === "yes") seg.observations.push(base(2, "accessibleToilet", true));
  if (v.toiletWheelchair === "no") seg.observations.push(base(2, "accessibleToilet", false));
  return seg;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Locale-independent "Sep 2026" (phone JavaScript engines may lack full Intl support). */
export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Plain-English description of what the community says, with its age. For display. */
export function describeCommunity(v: VenueFacts, editedAt: string | null, nowIso: string): { headline: string; age: string; note: string | null; usable: boolean } {
  const { date, kind } = communityDate(v, editedAt);
  const ageDays = date ? Math.floor((Date.parse(nowIso) - Date.parse(date)) / 86_400_000) : null;
  const when = date ? monthYear(date) : null;
  const age = date ? `${kind === "checked" ? "Checked" : "Last edited"} ${when}` : "No date available";
  const usable = ageDays !== null && ageDays <= COMMUNITY_TTL_DAYS && (v.wheelchair === "yes" || v.wheelchair === "no");
  const headline =
    v.wheelchair === "yes" ? "Contributors say it is wheelchair accessible."
    : v.wheelchair === "limited" ? "Contributors say it is only partly accessible."
    : v.wheelchair === "no" ? "Contributors say it is not wheelchair accessible."
    : "Nobody has entered accessibility information for this place yet.";
  return { headline, age, note: v.description, usable };
}
