import { describe, expect, it } from "vitest";
import type { Start, TripResult, Venue } from "@accesschain/core";
import { TripRunner, type TripState } from "./tripRunner";

const v: Venue = { id: "x", name: "X", query: "X" };
const s: Start = { kind: "station", id: "940GZZLUWLO", name: "Waterloo" };
const trip = (tag: string) => ({ fetchedAt: tag }) as unknown as TripResult;

function harness(plan: ConstructorParameters<typeof TripRunner>[0]) {
  const states: TripState[] = [];
  return { r: new TripRunner(plan, (x) => states.push(x)), states, last: () => states[states.length - 1]! };
}
const later = () => new Promise<void>((r) => setTimeout(r, 0));

describe("trip runner: busy never sticks", () => {
  it("normal run: busy, then the result", async () => {
    const h = harness(async () => trip("a"));
    await h.r.run(v, s);
    expect(h.states.map((x) => x.busy)).toEqual([true, false]);
    expect(h.last().trip?.fetchedAt).toBe("a");
  });
  it("REGRESSION: when planning throws, busy is cleared and an error is shown (it used to stay busy forever)", async () => {
    const h = harness(async () => { throw new Error("boom"); });
    await h.r.run(v, s);
    expect(h.last().busy).toBe(false);
    expect(h.last().error).toMatch(/Something went wrong/);
    expect(h.last().trip).toBeNull();
  });
  it("after a failure the next try works", async () => {
    let n = 0;
    const h = harness(async () => { if (++n === 1) throw new Error("boom"); return trip("ok"); });
    await h.r.run(v, s);
    await h.r.run(v, s);
    expect(h.last()).toMatchObject({ busy: false, error: null });
    expect(h.last().trip?.fetchedAt).toBe("ok");
  });
  it("an older answer arriving after a newer request is ignored", async () => {
    const resolvers: Array<(t: TripResult) => void> = [];
    const h = harness(() => new Promise<TripResult>((res) => { resolvers.push(res); }));
    const first = h.r.run(v, s);
    const second = h.r.run(v, s);
    resolvers[1]!(trip("new"));
    await second;
    resolvers[0]!(trip("old"));
    await first;
    expect(h.last().trip?.fetchedAt).toBe("new");
    expect(h.last().busy).toBe(false);
  });
  it("leaving the screen cancels: a late answer changes nothing", async () => {
    let resolve!: (t: TripResult) => void;
    const h = harness(() => new Promise<TripResult>((res) => { resolve = res; }));
    const p = h.r.run(v, s);
    h.r.cancel();
    resolve(trip("late"));
    await p;
    await later();
    expect(h.states.length).toBe(1);
  });
});
