import type { JourneyAssessment, RouteCandidate, Verdict } from "../types.js";

/**
 * Turns an assessment into plain sentences: what was checked, what could not be checked, what is a problem.
 * No numbers, scores or jargon. Wording never says "safe" or "accessible" as a promise.
 */
export interface Summary {
  verdict: Verdict;
  title: string;
  checked: string[];
  notChecked: string[];
  problems: string[];
  body: string;
}

const TITLE: Record<Verdict, string> = { known_fit: "Suits your needs", known_barrier: "Does not suit your needs", insufficient_evidence: "We can't be sure yet" };

function area(route: RouteCandidate, segmentId: string, requirement: string): string {
  if (segmentId === "*") return requirement === "walking distance" ? "how far you would walk" : "the whole route";
  const seg = route.segments.find((s) => s.id === segmentId);
  const where = !seg ? "the route" : seg.kind === "entrance" ? "the entrance" : seg.walking ? "the pavement" : "the transport";
  switch (requirement) {
    case "avoid steps": return where === "the pavement" ? "steps on the pavement" : where === "the entrance" ? "steps at the entrance" : "step-free transport";
    case "lift": return "the lifts on the way";
    case "clear width": return `doorway width at ${where}`;
    case "resting points": return "places to rest";
    case "accessible toilet": return "an accessible toilet";
    default: return where;
  }
}

const uniq = (a: string[]) => [...new Set(a)];

export function summarise(route: RouteCandidate, a: JourneyAssessment): Summary {
  const checked: string[] = [];
  const notChecked: string[] = [];
  const problems: string[] = [];
  for (const r of a.reasons) {
    if (r.requirement === "none set") continue;
    const what = area(route, r.segmentId, r.requirement);
    if (r.verdict === "known_fit") checked.push(what);
    else if (r.verdict === "known_barrier") problems.push(r.detail);
    else notChecked.push(what);
  }
  const c = uniq(checked);
  const n = uniq(notChecked.filter((x) => !c.includes(x)));
  const p = uniq(problems);
  const list = (xs: string[]) => xs.join(", ");
  let body: string;
  if (a.verdict === "known_fit") body = c.length ? `We checked ${list(c)}. Everything you asked for was found to be fine.` : "Everything you asked for was found to be fine.";
  else if (a.verdict === "known_barrier") body = `${p[0] ?? "Something you need is a problem on this route."}${n.length ? ` We could not check ${list(n)}.` : ""}`;
  else body = `${c.length ? `We checked ${list(c)}. ` : ""}We could not check ${list(n.length ? n : ["some of the route"])}. Please check with the venue before you go.`;
  return { verdict: a.verdict, title: TITLE[a.verdict], checked: c, notChecked: n, problems: p, body };
}
