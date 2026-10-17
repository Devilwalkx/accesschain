import type { Start, TripResult, Venue } from "@accesschain/core";

export interface TripState {
  busy: boolean;
  trip: TripResult | null;
  /** Set only if planning itself threw (it should not); the screen shows it and the button works again. */
  error: string | null;
}

/**
 * Runs one trip lookup at a time for a screen. `busy` always goes back to false, whatever happens (the old code left it stuck
 * if planning threw), and an answer that arrives after a newer request, or after the screen was left, is ignored.
 */
export class TripRunner {
  private seq = 0;
  constructor(
    private readonly plan: (v: Venue, s: Start) => Promise<TripResult>,
    private readonly onChange: (s: TripState) => void
  ) {}

  async run(v: Venue, s: Start): Promise<void> {
    const mine = ++this.seq;
    this.onChange({ busy: true, trip: null, error: null });
    try {
      const trip = await this.plan(v, s);
      if (mine === this.seq) this.onChange({ busy: false, trip, error: null });
    } catch {
      if (mine === this.seq) this.onChange({ busy: false, trip: null, error: "Something went wrong while checking. Nothing has been assumed. Please try again." });
    }
  }

  /** Ignore anything still in flight (screen left or start changed). */
  cancel(): void {
    this.seq++;
  }
}
