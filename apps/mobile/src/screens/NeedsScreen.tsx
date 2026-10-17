import React, { useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { parseProfile, type RequirementsProfile } from "@accesschain/core";
import { Button } from "../ui";
import { s } from "../theme";

const num = (t: string): number | undefined => (t.trim() === "" ? undefined : Number(t));

export function NeedsScreen(props: { profile: RequirementsProfile | null; onSave: (p: RequirementsProfile) => Promise<void>; onSaved: () => void }) {
  const p0 = props.profile;
  const [avoidSteps, setAvoid] = useState(p0?.avoidSteps ?? true);
  const [toilet, setToilet] = useState(p0?.needsAccessibleToilet ?? false);
  const [lift, setLift] = useState(p0?.liftAcceptable ?? true);
  const [assist, setAssist] = useState(p0?.assistanceAcceptable ?? false);
  const [walk, setWalk] = useState(p0?.maxWalkM?.toString() ?? "");
  const [width, setWidth] = useState(p0?.minClearWidthMm?.toString() ?? "");
  const [rest, setRest] = useState(p0?.maxRestGapM?.toString() ?? "");
  const [msg, setMsg] = useState("");

  // Quick starts only fill the form; nothing is saved until you press the save button, and you can edit everything.
  const presets: Array<[string, () => void]> = [
    ["No steps", () => { setAvoid(true); setLift(true); }],
    ["Short walks (200 m)", () => { setWalk("200"); setRest("100"); }],
    ["Wide doorways (800 mm)", () => setWidth("800")]
  ];

  const toggles: Array<[string, boolean, (v: boolean) => void]> = [
    ["Avoid steps", avoidSteps, setAvoid],
    ["I need an accessible toilet at the venue", toilet, setToilet],
    ["Lifts are acceptable", lift, setLift],
    ["Arranged assistance is acceptable", assist, setAssist]
  ];

  return (
    <ScrollView style={s.screen}>
      <Text style={s.h1} accessibilityRole="header">Your requirements</Text>
      <Text style={s.muted}>No diagnosis is asked for. These are stored encrypted on this device and matched here; they are not sent to a server in this build.</Text>
      <Text style={s.h2} accessibilityRole="header">Quick start (optional)</Text>
      <Text style={s.muted}>Tap to fill in common needs, then change anything you like.</Text>
      {presets.map(([text, apply]) => <Button key={text} label={text} onPress={apply} />)}
      <Text style={s.h2} accessibilityRole="header">Your needs</Text>
      {toggles.map(([text, value, set]) => (
        <View key={text} style={s.row}>
          <Text style={[s.p, { flex: 1 }]}>{text}</Text>
          <Switch value={value} onValueChange={set} accessibilityLabel={text} />
        </View>
      ))}
      <Text style={s.p}>Longest walk in metres (optional)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={walk} onChangeText={setWalk} accessibilityLabel="Longest walk in metres" />
      <Text style={s.p}>Minimum clear width in millimetres (optional)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={width} onChangeText={setWidth} accessibilityLabel="Minimum clear width in millimetres" />
      <Text style={s.p}>Longest gap between resting points in metres (optional)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={rest} onChangeText={setRest} accessibilityLabel="Longest gap between resting points in metres" />
      <Button
        label="Save and see journeys"
        onPress={async () => {
          try {
            const profile = parseProfile({
              avoidSteps, needsAccessibleToilet: toilet, liftAcceptable: lift, assistanceAcceptable: assist,
              ...(num(walk) !== undefined && { maxWalkM: num(walk) }),
              ...(num(width) !== undefined && { minClearWidthMm: num(width) }),
              ...(num(rest) !== undefined && { maxRestGapM: num(rest) })
            });
            await props.onSave(profile);
            setMsg("Saved.");
            props.onSaved();
          } catch {
            setMsg("Not saved: check the numbers you entered.");
          }
        }}
      />
      {msg !== "" && <Text style={s.p} accessibilityLiveRegion="polite">{msg}</Text>}
    </ScrollView>
  );
}
