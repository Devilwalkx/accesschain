import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  ATTRIBUTION, STATIONS, VENUES, assessAll, describeCommunity, summarise,
  type RequirementsProfile, type Start, type TripResult, type Venue
} from "@accesschain/core";
import { getCoarseOriginOnce } from "../location";
import { useLive } from "../live";
import { useS } from "../settings";
import { BackBar, Button, ModeBanner, StatusBox, type StatusKind } from "../ui";
import { PlanScreen as DemoPlan } from "./PlanScreen";

interface Props {
  profile: RequirementsProfile | null;
  onHome: () => void;
  onNeeds: () => void;
}

export function PlanFlow(props: Props) {
  const { mode } = useLive();
  if (mode === "unset") return <Consent onHome={props.onHome} />;
  if (mode === "demo") return <DemoPlan profile={props.profile} onHome={props.onHome} onNeeds={props.onNeeds} />;
  return <LiveFlow {...props} />;
}

function Consent({ onHome }: { onHome: () => void }) {
  const s = useS();
  const { setMode } = useLive();
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="Use live information?">
      <BackBar onHome={onHome} />
      <Text style={s.h1} accessibilityRole="header">Use live information?</Text>
      <Text style={s.p}>To check real routes, this app asks two public services:</Text>
      <View style={s.card}>
        <Text style={s.p}>• TfL (Transport for London): your start station, or your rough location, and the place you are going.</Text>
        <Text style={s.p}>• OpenStreetMap: the name of the place.</Text>
      </View>
      <Text style={s.p}>They can see your internet address. What you need (steps, distance and so on) never leaves your phone.</Text>
      <Button variant="primary" label="Yes, use live information" onPress={() => setMode("live")} />
      <Button label="No, use the demonstration instead" onPress={() => setMode("demo")} />
    </ScrollView>
  );
}

type Step = "place" | "start" | "result";

function LiveFlow({ profile, onHome, onNeeds }: Props) {
  const s = useS();
  const { client } = useLive();
  const [step, setStep] = useState<Step>("place");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [start, setStart] = useState<Start | null>(null);
  const [trip, setTrip] = useState<TripResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [locMsg, setLocMsg] = useState("");

  const run = useCallback(
    async (v: Venue, st: Start) => {
      setBusy(true);
      setTrip(null);
      setTrip(await client.planTrip(v, st));
      setBusy(false);
    },
    [client]
  );

  const chooseStart = async (st: Start) => {
    setStart(st);
    setStep("result");
    if (venue) await run(venue, st);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="Plan a journey">
      <BackBar onHome={onHome} />
      <ModeBanner />

      {step === "place" && (
        <>
          <Text style={s.h1} accessibilityRole="header">Where do you want to go?</Text>
          {VENUES.map((v) => (
            <Button key={v.id} label={v.name} onPress={() => { setVenue(v); setStep("start"); }} />
          ))}
        </>
      )}

      {step === "start" && venue && (
        <>
          <Text style={s.h1} accessibilityRole="header">Where are you starting from?</Text>
          <Text style={s.p}>Going to {venue.name}. Choose the nearest station.</Text>
          {STATIONS.map((st) => (
            <Button key={st.id} label={st.name} onPress={() => chooseStart({ kind: "station", id: st.id, name: st.name })} />
          ))}
          <Button
            label="Where I am now"
            hint="Uses your location once, rounded to about 100 metres"
            onPress={async () => {
              setLocMsg("");
              const p = await getCoarseOriginOnce().catch(() => null);
              if (!p) setLocMsg("We couldn't get your location. Please choose a station.");
              else chooseStart({ kind: "here", point: p });
            }}
          />
          {locMsg !== "" && <Text style={s.p} accessibilityRole="alert">{locMsg}</Text>}
          <Button label="‹ Choose a different place" onPress={() => setStep("place")} />
        </>
      )}

      {step === "result" && venue && start && (
        <Result
          profile={profile}
          venue={venue}
          start={start}
          trip={trip}
          busy={busy}
          onNeeds={onNeeds}
          onRefresh={() => run(venue, start)}
          onChangeStart={() => setStep("start")}
          onChangePlace={() => setStep("place")}
        />
      )}
    </ScrollView>
  );
}

const KIND = { known_fit: "fit", known_barrier: "barrier", insufficient_evidence: "unknown" } as const;

function Result(props: {
  profile: RequirementsProfile | null;
  venue: Venue;
  start: Start;
  trip: TripResult | null;
  busy: boolean;
  onNeeds: () => void;
  onRefresh: () => void;
  onChangeStart: () => void;
  onChangePlace: () => void;
}) {
  const s = useS();
  const { trip, profile } = props;
  const results = useMemo(() => (trip && profile ? assessAll(trip.routes, profile, trip.fetchedAt) : []), [trip, profile]);
  const fromName = props.start.kind === "station" ? props.start.name : "where you are";

  return (
    <>
      <Text style={s.h1} accessibilityRole="header">{props.venue.name}</Text>
      <Text style={s.muted}>From {fromName}.</Text>

      {props.busy && <Text style={s.p} accessibilityLiveRegion="polite">Checking the latest information…</Text>}

      {trip?.venue && <VenueCard trip={trip} />}

      {trip?.notices.map((n) => <Text key={n} style={s.p} accessibilityRole="alert">• {n}</Text>)}

      {!profile && (
        <View style={s.card}>
          <Text style={s.p}>Tell us what you need and we will check each route against it.</Text>
          <Button variant="primary" label="Tell us what you need" onPress={props.onNeeds} />
        </View>
      )}

      {trip?.startNotRecognised && <StatusBox kind="unknown" title="We couldn't use that start" body="TfL did not recognise the start. Please choose a different station." />}
      {trip?.noStepFreeRoute && (
        <StatusBox kind="unknown" title="No step-free route found" body="TfL could not find a step-free way to get there from here. Try another station, or ask the venue for help." />
      )}

      {profile && results.map(({ route, assessment }) => {
        const sum = summarise(route, assessment);
        return (
          <RouteCard key={route.id} title={route.title ?? "Route"} kind={KIND[assessment.verdict]} statusTitle={sum.title} body={sum.body}
            checked={sum.checked} notChecked={sum.notChecked} problems={sum.problems} notes={route.notes ?? []} directions={route.directions ?? []} />
        );
      })}

      {trip && (
        <Text style={s.muted}>
          Information fetched at {new Date(trip.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Live information is only trusted for 15 minutes.
        </Text>
      )}
      <Button label="Check again" onPress={props.onRefresh} />
      <Button label="‹ Change where I start" onPress={props.onChangeStart} />
      <Button label="‹ Choose a different place" onPress={props.onChangePlace} />
      <View style={s.card}>
        {ATTRIBUTION.map((a) => <Text key={a} style={s.muted}>{a}</Text>)}
        <Text style={s.muted}>We have not checked any of this ourselves. Please confirm with the venue before you travel.</Text>
      </View>
    </>
  );
}

function VenueCard({ trip }: { trip: TripResult }) {
  const s = useS();
  const v = trip.venue!;
  const d = describeCommunity(v, trip.venueEditedAt, trip.fetchedAt);
  return (
    <View style={s.card}>
      <Text style={s.h2} accessibilityRole="header">About the place</Text>
      <Text style={s.p}>{d.headline}</Text>
      {d.note && <Text style={s.p}>“{d.note}”</Text>}
      <Text style={s.muted}>{d.age}. Written by OpenStreetMap contributors{d.usable ? "." : ", so we don't count it as checked."}</Text>
    </View>
  );
}

function RouteCard(props: { title: string; kind: StatusKind; statusTitle: string; body: string; checked: string[]; notChecked: string[]; problems: string[]; notes: string[]; directions: string[] }) {
  const s = useS();
  const [why, setWhy] = useState(false);
  const [dir, setDir] = useState(false);
  useEffect(() => setWhy(false), [props.title]);
  return (
    <View style={s.card}>
      <Text style={s.h2} accessibilityRole="header">{props.title}</Text>
      <StatusBox kind={props.kind} title={props.statusTitle} body={props.body} />
      {props.notes.map((n) => <Text key={n} style={s.p} accessibilityRole="alert">{n}</Text>)}
      <Button label={why ? "Hide the details" : "What was checked?"} expanded={why} onPress={() => setWhy(!why)} />
      {why && (
        <View>
          {props.checked.map((c) => <Text key={`c${c}`} style={s.p}>✔ Checked: {c}</Text>)}
          {props.problems.map((c) => <Text key={`p${c}`} style={s.p}>✖ Problem: {c}</Text>)}
          {props.notChecked.map((c) => <Text key={`n${c}`} style={s.p}>? Could not check: {c}</Text>)}
        </View>
      )}
      {props.directions.length > 0 && (
        <>
          <Button label={dir ? "Hide the directions" : "Show the directions"} expanded={dir} onPress={() => setDir(!dir)} />
          {dir && props.directions.map((d, i) => <Text key={i} style={s.p}>{i + 1}. {d}</Text>)}
        </>
      )}
    </View>
  );
}
