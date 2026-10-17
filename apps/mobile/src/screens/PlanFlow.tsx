import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, View } from "react-native";
import {
  ATTRIBUTION, STATIONS, VENUES, ageText, assessRoute, briefToText, buildBriefs, describeCommunity, describeNeeds, normalisePostcode, syntheticRoutes, T0,
  type PartBrief, type RequirementsProfile, type RouteBrief, type SourceReport, type Start, type TripResult, type Venue
} from "@accesschain/core";
import { getCoarseOriginOnce } from "../location";
import { useLive } from "../live";
import { useApp } from "../store";
import { useTheme } from "../design/theme";
import { space } from "../design/tokens";
import { TripRunner, type TripState } from "../tripRunner";
import { Btn, Card, Chip, Collapsible, DemoStrip, Field, Gap, Loading, Notice, Toggle, Txt, type Tone } from "../ui";

export function PlanFlow() {
  const { mode } = useLive();
  const { scrollTop } = useApp();
  useEffect(() => { scrollTop(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  if (mode === "unset") return <Consent />;
  if (mode === "demo") return <DemoPlan />;
  return <LivePlan />;
}

function Consent() {
  const { setMode } = useLive();
  const c = useTheme();
  return (
    <View>
      <Txt v="title" header>Use live information?</Txt>
      <Txt>To check real routes, this app asks two public services:</Txt>
      <Card>
        <Txt>• TfL (Transport for London): your start (a station, your rough location, or a postcode you type) and where the place is.</Txt>
        <Txt>• OpenStreetMap: the name of the place.</Txt>
      </Card>
      <Txt>They can see your internet address. What you need (steps, distance and so on) never leaves your phone.</Txt>
      <Txt v="small" color={c.textMuted}>You can change this at any time in Privacy and help.</Txt>
      <Gap />
      <Btn id="consent-live" label="Yes, use live information" onPress={() => setMode("live")} />
      <Btn id="consent-demo" kind="secondary" label="No, use the demonstration instead" onPress={() => setMode("demo")} />
    </View>
  );
}

// ---------------------------------------------------------------- live

type View_ = { k: "place" } | { k: "start" } | { k: "result" };

function LivePlan() {
  const app = useApp();
  const { client } = useLive();
  const c = useTheme();
  const [view, setViewState] = useState<View_>({ k: "place" });
  const viewRef = useRef<View_>(view);
  const setView = (v: View_) => { viewRef.current = v; setViewState(v); };
  const [venue, setVenue] = useState<Venue | null>(null);
  const [start, setStart] = useState<Start | null>(null);
  const [state, setState] = useState<TripState>({ busy: false, trip: null, error: null });
  const runner = useRef(new TripRunner((v, s) => client.planTrip(v, s), setState));

  // System Back steps backwards through this flow: result -> start -> place -> Home.
  useEffect(() => {
    app.registerBack(() => {
      const k = viewRef.current.k;
      if (k === "result") { setView({ k: "start" }); return true; }
      if (k === "start") { setView({ k: "place" }); return true; }
      return false;
    });
    return () => app.registerBack(null);
  });
  useEffect(() => () => runner.current.cancel(), []);
  useEffect(() => { app.scrollTop(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.k]);

  const go = (v: Venue, s: Start) => {
    setStart(s);
    setView({ k: "result" });
    void runner.current.run(v, s);
  };

  return (
    <View>
      <ModeStrip />
      {view.k === "place" && (
        <>
          <Txt v="title" header>Where do you want to go?</Txt>
          <Txt color={c.textMuted}>This test version covers 10 places near the South Bank, London.</Txt>
          <Gap n={space.s} />
          {VENUES.map((v) => (
            <Btn key={v.id} kind="secondary" icon="place" align="left" label={v.name} onPress={() => { setVenue(v); setView({ k: "start" }); }} />
          ))}
        </>
      )}
      {view.k === "start" && venue && <StartPicker venue={venue} onStart={(s) => go(venue, s)} onBack={() => setView({ k: "place" })} />}
      {view.k === "result" && venue && start && (
        <LiveResult
          venue={venue}
          start={start}
          state={state}
          onRetry={() => void runner.current.run(venue, start)}
          onChangeStart={() => { runner.current.cancel(); setState({ busy: false, trip: null, error: null }); setView({ k: "start" }); }}
          onChangePlace={() => { runner.current.cancel(); setState({ busy: false, trip: null, error: null }); setView({ k: "place" }); }}
        />
      )}
    </View>
  );
}

function ModeStrip() {
  const { mode } = useLive();
  if (mode === "demo") return <DemoStrip text="Demonstration. The places and information are made up." />;
  if (mode === "live") return <Notice tone="info" text="Live information from TfL and OpenStreetMap. Notes written by the public can be out of date." />;
  return null;
}

function StartPicker({ venue, onStart, onBack }: { venue: Venue; onStart: (s: Start) => void; onBack: () => void }) {
  const c = useTheme();
  const [loc, setLoc] = useState<null | { kind: "denied"; canAskAgain: boolean } | { kind: "unavailable" }>(null);
  const [asking, setAsking] = useState(false);
  const [pc, setPc] = useState("");
  const [pcError, setPcError] = useState<string | null>(null);

  const here = async () => {
    if (asking) return;
    setAsking(true);
    setLoc(null);
    const r = await getCoarseOriginOnce();
    setAsking(false);
    if (r.kind === "ok") onStart({ kind: "here", point: r.point });
    else setLoc(r);
  };
  const usePostcode = () => {
    const n = normalisePostcode(pc);
    if (!n) { setPcError("That does not look like a UK postcode, for example SE1 9PX."); return; }
    setPcError(null);
    onStart({ kind: "postcode", postcode: n });
  };

  return (
    <View>
      <Txt v="title" header>Where are you starting from?</Txt>
      <Txt>Going to {venue.name}. Choose the nearest station.</Txt>
      <Gap n={space.s} />
      {STATIONS.map((st) => (
        <Btn key={st.id} kind="secondary" icon="route" align="left" label={st.name} onPress={() => onStart({ kind: "station", id: st.id, name: st.name })} />
      ))}

      <Txt v="heading" header>Somewhere else</Txt>
      <Card>
        <Txt v="label">Type a postcode</Txt>
        <Field label="Postcode" value={pc} onChange={(t) => { setPc(t); setPcError(null); }} autoCapitalize="characters" placeholder="for example SE1 9PX" error={pcError} onSubmit={usePostcode} />
        <Btn label="Use this postcode" onPress={usePostcode} />
        <Txt v="small" color={c.textMuted}>The postcode is sent to TfL as you typed it, so TfL can find the start. It is not sent to OpenStreetMap.</Txt>
      </Card>
      <Card>
        <Txt v="label">Use where I am now</Txt>
        <Txt v="small" color={c.textMuted}>Your phone will ask permission once. We read your location one time, round it to about 100 metres, and do not keep it.</Txt>
        <Gap n={space.s} />
        <Btn id="where-i-am-now" kind="secondary" icon="place" label="Where I am now" hint="Uses your location once, rounded to about 100 metres" disabled={asking} onPress={here} />
        {loc?.kind === "denied" && loc.canAskAgain && (
          <Notice tone="wait" text="Location was not allowed, so we cannot use it. You can choose a station or type a postcode instead, or tap the button again to allow it." />
        )}
        {loc?.kind === "denied" && !loc.canAskAgain && (
          <>
            <Notice tone="wait" text="Location is switched off for this app and the phone will not ask again. Choose a station or type a postcode instead, or turn it on in the phone's settings." />
            <Btn kind="secondary" icon="settings" label="Open phone settings" onPress={() => { Linking.openSettings().catch(() => undefined); }} />
          </>
        )}
        {loc?.kind === "unavailable" && <Notice tone="wait" text="We couldn't find where you are. Location may be switched off or have no signal. Please choose a station or type a postcode." />}
      </Card>
      <Btn kind="quiet" label="Choose a different place" onPress={onBack} />
    </View>
  );
}

const SOURCE_NAME = { place: "OpenStreetMap (the place)", route: "TfL journey planner", lifts: "TfL lift list" } as const;

function sourceLine(name: string, s: SourceReport, nowIso: string): { tone: Tone; text: string } {
  switch (s.state) {
    case "ok": return { tone: "ok", text: `${name}: answered ${ageText(s.at, nowIso)}.` };
    case "not_found": return { tone: "wait", text: `${name}: answered ${ageText(s.at, nowIso)}, but found nothing for this place.` };
    case "slow": return { tone: "bad", text: `${name}: too slow to answer.` };
    case "unreachable": return { tone: "bad", text: `${name}: no answer. Check your connection.` };
    case "unavailable": return { tone: "bad", text: `${name}: answered with an error.` };
    case "skipped": return { tone: "wait", text: `${name}: not asked.` };
  }
}

function startName(start: Start): string {
  return start.kind === "station" ? start.name : start.kind === "postcode" ? start.postcode.toUpperCase() : "where you are";
}

function LiveResult(props: { venue: Venue; start: Start; state: TripState; onRetry: () => void; onChangeStart: () => void; onChangePlace: () => void }) {
  const { profile, go } = useApp();
  const c = useTheme();
  const { trip, busy, error } = props.state;
  // "checked N minutes ago" keeps counting while the result is open, and evidence older than 15 minutes stops counting.
  const [nowIso, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    setNow(new Date().toISOString());
    const t = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(t);
  }, [trip]);
  const briefs = useMemo(() => {
    if (!trip || trip.routes.length === 0) return [];
    const a = trip.routes.map((r) => (profile ? assessRoute(r, profile, nowIso) : null));
    return buildBriefs(trip.routes, a, {
      nowIso, live: true, venue: trip.venue, venueEditedAt: trip.venueEditedAt, venueName: props.venue.name,
      liftsUnavailable: trip.sources.lifts.state !== "ok"
    });
  }, [trip, profile, props.venue.name, nowIso]);
  const oldResult = !!trip && Date.parse(nowIso) - Date.parse(trip.fetchedAt) > 15 * 60_000;

  return (
    <View>
      <Txt v="title" header>{props.venue.name}</Txt>
      <Txt color={c.textMuted}>From {startName(props.start)}.</Txt>
      <NeedsLine profile={profile} onNeeds={() => go("needs")} />

      {busy && <Loading text="Checking the latest information…" />}
      {error && <Notice tone="bad" text={error} />}

      {trip?.startMismatch && (
        <Notice tone="wait" text={`TfL started your journey from “${trip.startUsedName}”, which is not exactly what you typed. Please check that this is the right start.`} />
      )}
      {trip?.startNotRecognised && <Notice tone="wait" text="TfL did not recognise that start. Please choose a different start." />}
      {trip?.noStepFreeRoute && (
        <Card tone="wait">
          <Txt v="heading" header>No step-free route found</Txt>
          <Txt>TfL could not find a step-free way to get there from here. Try another start, or ask the venue for help.</Txt>
        </Card>
      )}
      {trip?.notices.map((n) => <Notice key={n} tone="wait" text={n} />)}
      {oldResult && <Notice tone="wait" text="This answer is more than 15 minutes old, so it no longer counts as checked. Tap “Check again”." />}

      {trip?.venue && <PlaceCard trip={trip} />}

      {briefs.map((b, i) => (
        <RouteBlock key={b.routeId} brief={b} index={i + 1} total={briefs.length} directions={trip!.routes[i]!.directions ?? []} notes={trip!.routes[i]!.notes ?? []} />
      ))}

      {trip && !busy && <SourceCard trip={trip} nowIso={nowIso} />}
      <Btn id="retry" kind="secondary" icon="refresh" label={busy ? "Checking…" : "Check again"} disabled={busy} onPress={props.onRetry} />
      <Btn kind="quiet" label="Change where I start" onPress={props.onChangeStart} />
      <Btn kind="quiet" label="Choose a different place" onPress={props.onChangePlace} />
      <Attribution />
    </View>
  );
}

function SourceCard({ trip, nowIso }: { trip: TripResult; nowIso: string }) {
  const c = useTheme();
  return (
    <Card accessibilityLabel="Which services answered">
      <Txt v="heading" header>What answered</Txt>
      {(["place", "route", "lifts"] as const).map((k) => {
        const l = sourceLine(SOURCE_NAME[k], trip.sources[k], nowIso);
        return <Chip key={k} tone={l.tone} text={l.text} />;
      })}
      <Txt v="small" color={c.textMuted}>Live information is only trusted for 15 minutes. If part of it failed, that part is shown as not checked, never as fine.</Txt>
    </Card>
  );
}

function NeedsLine({ profile, onNeeds }: { profile: RequirementsProfile | null; onNeeds: () => void }) {
  const c = useTheme();
  if (!profile) {
    return (
      <Card>
        <Txt>Tell us what you need and we will check each part of the journey against it.</Txt>
        <Btn label="Tell us what you need" onPress={onNeeds} />
      </Card>
    );
  }
  return (
    <View style={{ marginBottom: space.s }}>
      <Txt v="label" color={c.textMuted}>Checked against your needs:</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xs }}>
        {describeNeeds(profile).map((n) => <Chip key={n} tone="info" text={n} />)}
      </View>
    </View>
  );
}

function PlaceCard({ trip }: { trip: TripResult }) {
  const c = useTheme();
  const v = trip.venue!;
  const d = describeCommunity(v, trip.venueEditedAt, trip.fetchedAt);
  return (
    <Card>
      <Txt v="heading" header>About the place</Txt>
      <Txt>{d.headline}</Txt>
      {d.note ? <Txt>“{d.note}”</Txt> : null}
      <Txt v="small" color={c.textMuted}>{d.age}. Written by OpenStreetMap contributors{d.usable ? "." : ", so we don't count it as checked."}</Txt>
    </Card>
  );
}

const PART_TONE: Record<PartBrief["status"], Tone> = {
  confirmed: "ok", problem: "bad", unconfirmed: "wait", not_needed: "info", no_requirement: "info", not_checked: "wait"
};

function RouteBlock({ brief, index, total, directions, notes }: { brief: RouteBrief; index: number; total: number; directions: string[]; notes: string[] }) {
  const c = useTheme();
  const tone: Tone = brief.verdict === "known_fit" ? "ok" : brief.verdict === "known_barrier" ? "bad" : "wait";
  const word = brief.verdict === "known_fit" ? "Suits your needs" : brief.verdict === "known_barrier" ? "Does not suit your needs" : brief.verdict === "not_checked" ? "Not checked against your needs" : "We can't be sure yet";
  return (
    <View accessibilityLabel={`Route ${index} of ${total}`}>
      <Txt v="heading" header>{total > 1 ? `Route ${index}: ` : ""}{brief.title}</Txt>
      <Chip tone={tone} text={word} />
      <Txt>{brief.headline}</Txt>
      {notes.map((n) => <Notice key={n} tone="wait" text={n} />)}
      <Gap n={space.xs} />
      {brief.parts.map((p) => <PartBlock key={p.id} part={p} />)}
      {directions.length > 0 && (
        <Collapsible title="Turn-by-turn directions from TfL">
          {directions.map((d, i) => <Txt key={i}>{i + 1}. {d}</Txt>)}
        </Collapsible>
      )}
      <Collapsible title="Read this route as plain text">
        <Txt selectable>{briefToText(brief)}</Txt>
      </Collapsible>
      <View style={{ height: 1, backgroundColor: c.line, marginVertical: space.m }} />
    </View>
  );
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

function PartBlock({ part }: { part: PartBrief }) {
  const c = useTheme();
  return (
    <Card accessibilityLabel={`${part.title}: ${part.statusText}`}>
      <Txt v="heading" header>{part.title}</Txt>
      <Chip tone={PART_TONE[part.status]} text={part.statusText} />
      <Txt v="small" color={c.textMuted}>{part.about}</Txt>
      {part.legs.map((l, i) => <Txt key={i}>{l}</Txt>)}
      {part.known.length > 0 && <Txt v="label">What we know</Txt>}
      {part.known.map((k, i) => <Txt key={`k${i}`}>• {k}</Txt>)}
      {part.missing.length > 0 && <Txt v="label">What is missing</Txt>}
      {part.missing.map((m, i) => <Txt key={`m${i}`}>• {m}</Txt>)}
      <Txt v="label">How old the information is</Txt>
      <Txt>{part.age}</Txt>
      {part.nextSteps.length > 0 && <Txt v="label">What you can do</Txt>}
      {part.nextSteps.map((n, i) => (
        <View key={`n${i}`}>
          <Txt>• {n.text}</Txt>
          {n.phone && <Btn kind="secondary" icon="phone" label={`Call ${n.phone}`} onPress={() => openUrl(`tel:${n.phone!.replace(/[^+0-9]/g, "")}`)} />}
          {n.url && <Btn kind="secondary" icon="open" label={n.url.includes("openstreetmap.org") ? "Open OpenStreetMap page" : "Open website"} hint="Opens in your browser" onPress={() => openUrl(n.url!)} />}
        </View>
      ))}
    </Card>
  );
}

function Attribution() {
  const c = useTheme();
  return (
    <Card>
      {ATTRIBUTION.map((a) => <Txt key={a} v="small" color={c.textMuted}>{a}</Txt>)}
      <Txt v="small" color={c.textMuted}>We have not checked any of this ourselves. Please confirm with the venue before you travel.</Txt>
      <Btn kind="secondary" icon="open" label="OpenStreetMap copyright and licence" hint="Opens in your browser" onPress={() => openUrl("https://www.openstreetmap.org/copyright")} />
    </Card>
  );
}

// ---------------------------------------------------------------- demonstration

function DemoPlan() {
  const { profile, go } = useApp();
  const [later, setLater] = useState(false);
  const at = later ? new Date(Date.parse(T0) + 45 * 60_000).toISOString() : T0;
  const routes = useMemo(() => syntheticRoutes(), []);
  const NAMES: Record<string, string> = { "route-main": "Main entrance on Example Road", "route-side": "Side entrance on Mill Lane" };
  const briefs = useMemo(() => {
    const named = routes.map((r) => ({ ...r, title: NAMES[r.id] ?? r.id }));
    return buildBriefs(named, named.map((r) => (profile ? assessRoute(r, profile, at) : null)), { nowIso: at, live: false, venue: null, venueEditedAt: null, venueName: "Fictional Hall" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, profile, at]);
  const anyFit = briefs.some((b) => b.verdict === "known_fit");
  return (
    <View>
      <ModeStrip />
      <Txt v="title" header>Getting to Fictional Hall</Txt>
      <Txt>Starting from Example Road station.</Txt>
      <NeedsLine profile={profile} onNeeds={() => go("needs")} />
      {profile && <Txt>{anyFit ? "We found a route that suits you." : "We can't recommend a route yet. Please phone the venue to check."}</Txt>}
      {briefs.map((b, i) => <RouteBlock key={b.routeId} brief={b} index={i + 1} total={briefs.length} directions={[]} notes={[]} />)}
      <Collapsible title="Demonstration options">
        <Txt>Lift information is only trusted for 30 minutes. Pretend time has passed to see what happens.</Txt>
        <Toggle label="Pretend 45 minutes have passed" on={later} onChange={setLater} />
      </Collapsible>
    </View>
  );
}
