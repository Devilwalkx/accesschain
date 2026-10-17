import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  assessRoute, evidenceBackedAlternatives, label, renderTextItinerary, syntheticRoutes, T0, type RequirementsProfile
} from "@accesschain/core";
import { Button, SyntheticBanner } from "../ui";
import { s } from "../theme";

const DEMO_TIMES = [
  { label: "Demo time: now (09:00)", at: T0 },
  { label: "Demo time: +45 min (lift feed expired)", at: new Date(Date.parse(T0) + 45 * 60_000).toISOString() }
];

export function PlanScreen({ profile }: { profile: RequirementsProfile | null }) {
  const [timeIx, setTimeIx] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const at = DEMO_TIMES[timeIx]!.at;
  const routes = useMemo(() => syntheticRoutes(), []);
  const results = useMemo(() => (profile ? routes.map((r) => ({ r, a: assessRoute(r, profile, at) })) : []), [profile, routes, at]);
  const alts = profile ? evidenceBackedAlternatives(results.map((x) => x.a)) : [];

  return (
    <ScrollView style={s.screen} accessibilityLabel="Plan a journey">
      <SyntheticBanner />
      <Text style={s.h1} accessibilityRole="header">Journey to Fictional Hall</Text>
      <Text style={s.muted}>Start: Example Road station (fictional). Choose a demo time to see how expired live data changes the answer.</Text>
      {DEMO_TIMES.map((d, i) => <Button key={d.at} label={d.label} selected={i === timeIx} onPress={() => setTimeIx(i)} />)}
      {!profile && <Text style={s.p}>Set your requirements first (Needs tab). They are matched on this device only.</Text>}
      {results.map(({ r, a }) => (
        <View key={r.id} style={s.card}>
          <Text style={s.h2} accessibilityRole="header">{r.id}: {label(a.verdict)}</Text>
          <Text style={s.muted}>{a.verdict === "known_fit" ? "Every requirement you set has fresh evidence that it is met." : a.verdict === "known_barrier" ? "At least one requirement is known not to be met." : "Some required information is missing, expired or in conflict. This is not a pass."}</Text>
          <Button label={open === r.id ? "Hide text itinerary" : "Show text itinerary"} onPress={() => setOpen(open === r.id ? null : r.id)} />
          {open === r.id && <Text style={s.mono} selectable>{renderTextItinerary(r, a)}</Text>}
        </View>
      ))}
      {profile && (
        <Text style={s.p}>
          {alts.length > 0 ? `Evidence-backed option: ${alts.map((a) => a.routeId).join(", ")}.` : "No route has enough evidence to be offered as suitable right now. Contact the venue or operator to confirm."}
        </Text>
      )}
    </ScrollView>
  );
}
