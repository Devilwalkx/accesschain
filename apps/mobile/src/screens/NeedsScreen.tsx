import React, { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { parseProfile, type RequirementsProfile } from "@accesschain/core";
import { BackBar, Button, ToggleRow } from "../ui";
import { useS } from "../settings";

const num = (t: string): number | undefined => (t.trim() === "" ? undefined : Number(t));

export function NeedsScreen(props: {
  profile: RequirementsProfile | null;
  onSave: (p: RequirementsProfile) => Promise<void>;
  onSaved: () => void;
  onHome: () => void;
}) {
  const s = useS();
  const p0 = props.profile;
  const [avoidSteps, setAvoid] = useState(p0?.avoidSteps ?? true);
  const [toilet, setToilet] = useState(p0?.needsAccessibleToilet ?? false);
  const [lift, setLift] = useState(p0?.liftAcceptable ?? true);
  const [assist, setAssist] = useState(p0?.assistanceAcceptable ?? false);
  const [more, setMore] = useState(false);
  const [walk, setWalk] = useState(p0?.maxWalkM?.toString() ?? "");
  const [width, setWidth] = useState(p0?.minClearWidthMm?.toString() ?? "");
  const [rest, setRest] = useState(p0?.maxRestGapM?.toString() ?? "");
  const [msg, setMsg] = useState("");

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="My needs">
      <BackBar onHome={props.onHome} />
      <Text style={s.h1} accessibilityRole="header">What do you need?</Text>
      <Text style={s.p}>Tap anything that applies. Your answers stay on this phone, and you can change them any time.</Text>

      <ToggleRow label="I can't manage steps" value={avoidSteps} onChange={setAvoid} />
      <ToggleRow label="Lifts are fine for me" value={lift} onChange={setLift} />
      <ToggleRow label="I'm happy to ask for help at the door" value={assist} onChange={setAssist} />
      <ToggleRow label="I need an accessible toilet" value={toilet} onChange={setToilet} />

      <Button label={more ? "Hide extra details" : "Walking and doorway details (optional)"} expanded={more} onPress={() => setMore(!more)} />
      {more && (
        <>
          <Text style={s.p}>Longest walk you can manage, in metres</Text>
          <TextInput style={s.input} keyboardType="numeric" value={walk} onChangeText={setWalk} accessibilityLabel="Longest walk in metres" />
          <Text style={s.p}>Narrowest doorway you can use, in millimetres</Text>
          <TextInput style={s.input} keyboardType="numeric" value={width} onChangeText={setWidth} accessibilityLabel="Narrowest doorway in millimetres" />
          <Text style={s.p}>Longest stretch without somewhere to rest, in metres</Text>
          <TextInput style={s.input} keyboardType="numeric" value={rest} onChangeText={setRest} accessibilityLabel="Longest stretch without a rest in metres" />
          <Button label="Short walks (200 m)" onPress={() => { setWalk("200"); setRest("100"); }} />
          <Button label="Wide doorways (800 mm)" onPress={() => setWidth("800")} />
        </>
      )}

      <Button
        variant="primary"
        label="Save and see my routes"
        onPress={async () => {
          try {
            const profile = parseProfile({
              avoidSteps, needsAccessibleToilet: toilet, liftAcceptable: lift, assistanceAcceptable: assist,
              ...(num(walk) !== undefined && { maxWalkM: num(walk) }),
              ...(num(width) !== undefined && { minClearWidthMm: num(width) }),
              ...(num(rest) !== undefined && { maxRestGapM: num(rest) })
            });
            await props.onSave(profile);
            props.onSaved();
          } catch {
            setMsg("We couldn't save that. Please check the numbers you typed.");
          }
        }}
      />
      {msg !== "" && <Text style={s.p} accessibilityLiveRegion="polite" accessibilityRole="alert">{msg}</Text>}
    </ScrollView>
  );
}
