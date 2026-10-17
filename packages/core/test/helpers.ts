import type { RouteCandidate, Segment } from "../src/index.js";

export function seg(id: string, kind: Segment["kind"], over: Partial<Segment> = {}): Segment {
  return { id, kind, label: id, walking: false, observations: [], ...over };
}
export function route(id: string, segments: Segment[]): RouteCandidate {
  return { id, provider: "test", segments };
}
export const NOW = "2026-10-17T09:00:00.000Z";
export const FUTURE = "2027-10-17T09:00:00.000Z";
