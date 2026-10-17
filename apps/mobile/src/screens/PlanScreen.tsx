import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  assessRoute, renderTextItinerary, syntheticRoutes, T0, type JourneyAssessment, type RequirementsProfile, type RouteCandidate, type Verdict
} from "@accesschain/core";
import { BackBar, Button, StatusBox, ToggleRow, SyntheticBanner, type StatusKind } from "../ui";
import { useS } from "../settings";

const NAMES: Record<string, string> = { "route-main": "Main entrance on Example Road", "route-side": "Side entrance on Mill Lane" };
const REQ: Record<string, string> = {
  "avoid steps": "Steps", lift: "Lift", "clear width": "Doorway width", "resting points": "Places to rest",
  "accessible toilet": "Accessible toilet", "walking distance": "Walking distance", "journey completeness": "Whole journey", "none set": "Your needs"
};
const KIND: Record<Verdict, StatusKind> = { known_fit: "fit", known_barrier: "barrier", insufficient_evidence: "unknown" };
const TITLE: Record<Verdict, string> = { known_fit: "Suits your needs", known_barrier: "Does not suit your needs", insufficient_evidence: "We can't be sure yet" };
const BODY: Record<Verdict, string> = {
  known_fit: "Everything you asked for has been checked recently.",
  known_barrier: "Something you need is a problem on this route.",
  insufficient_evidence: "Some information is missing or out of date. Please check with the venue before you go."
};
const SYM: Record<Verdict, string> = { known_fit: "✔", known_barrier: "✖", insufficient_evidence: "?" };

function RouteCard(props: { route: RouteCandidate; a: JourneyAssessment }) {
  const s = useS();
  const [why, setWhy] = useState(false);
  const [full, setFull] = useState(false);
  const { route, a } = props;
  return (
    <View style={s.card}>
      <Text style={s.h2} accessibilityRole="header">{NAMES[route.id] ?? route.id}</Text>
      <StatusBox kind={KIND[a.verdict]} title={TITLE[a.verdict]} body={BODY[a.verdict]} />
      <Button label={why ? "Hide the reasons" : "Why?"} expanded={why} onPress={() => setWhy(!why)} />
      {why && (
        <View>
          {a.reasons.map((r, i) => (
            <Text key={i} style={s.p}>
              {SYM[r.verdict]} {REQ[r.requirement] ?? r.requirement}: {r.detail}
            </Text>
          ))}
          <Button label={full ? "Hide the full text" : "Read it all as text"} expanded={full} onPress={() => setFull(!full)} />
          {full && <Text style={s.mono} selectable>{renderTextItinerary(route, a)}</Text>}
        </View>
      )}
    </View>
  );
}

export function PlanScreen(props: { profile: RequirementsProfile | null; onHome: () => void; onNeeds: () => void }) {
  const s = useS();
  const [later, setLater] = useState(false);
  const [demo, setDemo] = useState(false);
  const at = later ? new Date(Date.parse(T0) + 45 * 60_000).toISOString() : T0;
  const routes = useMemo(() => syntheticRoutes(), []);
  const results = useMemo(() => (props.profile ? routes.map((r) => ({ r, a: assessRoute(r, props.profile!, at) })) : []), [props.profile, routes, at]);
  const anyFit = results.some((x) => x.a.verdict === "known_fit");

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="Plan a journey">
      <BackBar onHome={props.onHome} />
      <SyntheticBanner />
      <Text style={s.h1} accessibilityRole="header">Getting to Fictional Hall</Text>
      <Text style={s.muted}>Starting from Example Road station.</Text>

      {!props.profile ? (
        <View style={s.card}>
          <Text style={s.p}>First, tell us what you need, so we can check each route for you.</Text>
          <Button variant="primary" label="Tell us what you need" onPress={props.onNeeds} />
        </View>
      ) : (
        <>
          <Text style={s.p}>{anyFit ? "We found a route that suits you." : "We can't recommend a route yet. Please phone the venue to check."}</Text>
          {results.map(({ r, a }) => <RouteCard key={r.id} route={r} a={a} />)}
        </>
      )}

      <Button label={demo ? "Hide demonstration options" : "Demonstration options"} expanded={demo} onPress={() => setDemo(!demo)} />
      {demo && (
        <View style={s.card}>
          <Text style={s.p}>Lift information is only trusted for 30 minutes. Pretend time has passed to see what happens.</Text>
          <ToggleRow label="Pretend 45 minutes have passed" value={later} onChange={setLater} />
        </View>
      )}
    </ScrollView>
  );
}
