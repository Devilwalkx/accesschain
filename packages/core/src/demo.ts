import { assessRoute } from "./match.js";
import { label, liveChanges, renderTextItinerary, saveItinerary } from "./itinerary.js";
import { SYNTHETIC_NOTICE, T0, pavementFieldCheck, syntheticProfile, syntheticRoutes } from "./synthetic.js";
import type { Verdict } from "./types.js";

export interface DemoStep {
  title: string;
  at: string;
  routeId: string;
  verdict: Verdict;
}

/** Runs the synthetic scenario and returns a Markdown report plus the verdict sequence (asserted in tests). */
export function runDemo(): { markdown: string; steps: DemoStep[] } {
  const profile = syntheticProfile();
  const steps: DemoStep[] = [];
  const out: string[] = [];
  const [main, side] = syntheticRoutes() as [ReturnType<typeof syntheticRoutes>[0], ReturnType<typeof syntheticRoutes>[0]];

  out.push("# AccessChain synthetic demo", "", `> ${SYNTHETIC_NOTICE} "Example Road station" and "Fictional Hall" do not exist.`, "");
  out.push("Requirements profile (held on-device in the real app, shown here because it is synthetic):", "", "```json", JSON.stringify(profile, null, 2), "```", "");

  const record = (title: string, at: string, route: typeof main) => {
    const a = assessRoute(route, profile, at);
    steps.push({ title, at, routeId: route.id, verdict: a.verdict });
    out.push(`## ${title}`, "", `Assessed at ${at}. Result: **${label(a.verdict)}**.`, "", "```text", renderTextItinerary(route, a), "```", "");
    return a;
  };

  record("1. Main entrance (steps): a known barrier, though the station route is valid", T0, main);
  const before = record("2. Side entrance, pavement not field-checked: insufficient evidence, not a pass", T0, side);
  const saved = saveItinerary("demo-itinerary", side, before);

  side.segments[1]!.observations.push(...pavementFieldCheck());
  const verified = record("3. After a paid tester field-checks the pavement: known fit", T0, side);
  const savedVerified = saveItinerary("demo-itinerary-verified", side, verified);

  const later = new Date(Date.parse(T0) + 45 * 60_000).toISOString();
  const stale = record("4. 45 minutes later the live lift feed has expired: back to insufficient evidence", later, side);
  out.push("### What changed since the itinerary was saved", "");
  for (const c of liveChanges(savedVerified, stale)) out.push(`- ${c.detail}`);
  out.push("", `(The first saved itinerary was saved as: ${label(saved.verdictAtSave)}.)`, "");
  out.push("The app never shows a cached \"all clear\": once the lift feed expires the segment is unknown until a fresh observation arrives.", "");
  return { markdown: out.join("\n"), steps };
}
