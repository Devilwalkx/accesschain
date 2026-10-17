import React, { useState } from "react";
import { View } from "react-native";
import { parseProfile } from "@accesschain/core";
import { useApp } from "../store";
import { useTheme } from "../design/theme";
import { Btn, Collapsible, Field, Notice, Toggle, Txt } from "../ui";

const num = (t: string): number | undefined => (t.trim() === "" ? undefined : Number(t));

export function NeedsScreen() {
  const app = useApp();
  const c = useTheme();
  const p0 = app.profile;
  const [avoidSteps, setAvoid] = useState(p0?.avoidSteps ?? true);
  const [toilet, setToilet] = useState(p0?.needsAccessibleToilet ?? false);
  const [lift, setLift] = useState(p0?.liftAcceptable ?? true);
  const [assist, setAssist] = useState(p0?.assistanceAcceptable ?? false);
  const [walk, setWalk] = useState(p0?.maxWalkM?.toString() ?? "");
  const [width, setWidth] = useState(p0?.minClearWidthMm?.toString() ?? "");
  const [rest, setRest] = useState(p0?.maxRestGapM?.toString() ?? "");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const profile = parseProfile({
        avoidSteps, needsAccessibleToilet: toilet, liftAcceptable: lift, assistanceAcceptable: assist,
        ...(num(walk) !== undefined && { maxWalkM: num(walk) }),
        ...(num(width) !== undefined && { minClearWidthMm: num(width) }),
        ...(num(rest) !== undefined && { maxRestGapM: num(rest) })
      });
      await app.saveProfile(profile);
      app.go("plan");
    } catch {
      setMsg("We couldn't save that. Please check the numbers you typed.");
      setSaving(false);
    }
  };

  return (
    <View>
      <Txt v="title" header>What do you need?</Txt>
      <Txt>Tap anything that applies. Your answers stay on this phone, and you can change them any time.</Txt>
      <Toggle label="I can't manage steps" on={avoidSteps} onChange={setAvoid} />
      <Toggle label="Lifts are fine for me" on={lift} onChange={setLift} />
      <Toggle label="I'm happy to ask for help at the door" on={assist} onChange={setAssist} />
      <Toggle label="I need an accessible toilet" on={toilet} onChange={setToilet} />

      <Collapsible title="Walking and doorway details (optional)">
        <Field label="Longest walk in metres" keyboard="numeric" value={walk} onChange={setWalk} />
        <Field label="Narrowest doorway in millimetres" keyboard="numeric" value={width} onChange={setWidth} />
        <Field label="Longest stretch without a rest in metres" keyboard="numeric" value={rest} onChange={setRest} />
        <Btn kind="secondary" label="Short walks (200 m)" onPress={() => { setWalk("200"); setRest("100"); }} />
        <Btn kind="secondary" label="Wide doorways (800 mm)" onPress={() => setWidth("800")} />
      </Collapsible>

      {msg !== "" && <Notice tone="bad" text={msg} />}
      <Btn id="save-needs" label="Save and see my routes" disabled={saving} onPress={save} />
      <Txt v="small" color={c.textMuted}>Saved on this phone only, locked with a key this phone holds. If you lose the phone, you answer these questions again.</Txt>
    </View>
  );
}
