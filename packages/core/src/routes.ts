import { z } from "zod";
import { minimiseCoordinate, type LatLng } from "./privacy.js";
import type { RouteCandidate } from "./types.js";

/**
 * Route candidates come from a licensed external service. This module defines the contract we
 * require of an adapter and the failure handling around it. No concrete provider is implemented
 * here: the TfL Unified API / chosen routing service must be verified against its actual
 * documentation and licence first (see DECISIONS.md D-006, blocked: docs unreachable from this build environment).
 */

export interface RouteRequest {
  origin: LatLng;
  destinationVenueId: string;
}

export interface RouteProvider {
  readonly name: string;
  /** Must return segment structure and any known observations; must not invent traversable paths. */
  getCandidates(req: RouteRequest, signal: AbortSignal): Promise<unknown>;
}

const CandidateSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  segments: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["arrival", "transfer", "approach", "entrance"]),
        label: z.string().min(1),
        usesLift: z.boolean().optional(),
        walking: z.boolean(),
        observations: z.array(z.any())
      })
    )
    .min(1)
});

export type RouteLookup =
  | { status: "ok"; candidates: RouteCandidate[]; sentOrigin: LatLng }
  | { status: "unavailable"; reason: "timeout" | "error" | "invalid_response" | "quota"; message: string };

export class QuotaError extends Error {}

/**
 * Calls the provider with minimised coordinates, a timeout and response validation.
 * Any failure becomes a visible "unavailable" state; there is no cached "all clear".
 */
export async function lookupRoutes(
  provider: RouteProvider,
  req: RouteRequest,
  opts: { timeoutMs: number; coordinateDecimals?: number }
): Promise<RouteLookup> {
  let sentOrigin: LatLng;
  try {
    sentOrigin = minimiseCoordinate(req.origin, opts.coordinateDecimals ?? 3);
  } catch {
    return { status: "unavailable", reason: "invalid_response", message: "Origin coordinates are invalid." };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const raw = await provider.getCandidates({ ...req, origin: sentOrigin }, ctl.signal);
    const parsed = z.array(CandidateSchema).safeParse(raw);
    if (!parsed.success) {
      return { status: "unavailable", reason: "invalid_response", message: "Route service returned data we could not validate." };
    }
    return { status: "ok", candidates: parsed.data as RouteCandidate[], sentOrigin };
  } catch (e) {
    if (ctl.signal.aborted) return { status: "unavailable", reason: "timeout", message: "Route service did not respond in time." };
    if (e instanceof QuotaError) return { status: "unavailable", reason: "quota", message: "Route service quota reached." };
    return { status: "unavailable", reason: "error", message: "Route service failed." };
  } finally {
    clearTimeout(timer);
  }
}
