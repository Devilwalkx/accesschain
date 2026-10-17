import React from "react";
import { View } from "react-native";
import { useApp } from "../store";
import { useLive } from "../live";
import { useTheme } from "../design/theme";
import { space } from "../design/tokens";
import { Btn, Card, DemoStrip, Gap, Loading, Notice, Txt } from "../ui";
import { TextSizeChoice } from "./Settings";

export function HomeScreen() {
  const app = useApp();
  const { mode } = useLive();
  const c = useTheme();
  const has = !!app.profile;
  if (!app.loaded) return <Loading text="Opening…" />;
  return (
    <View>
      {app.loadError ? <Notice tone="bad" text={app.loadError} /> : null}
      {mode === "demo" ? <DemoStrip text="Demonstration mode. The places and information are made up. Change this in Privacy and help." /> : null}
      <Txt v="display">AccessChain</Txt>
      <Txt>Find out if you can get there, before you set off.</Txt>
      <Gap n={space.s} />
      {!has ? (
        <>
          <Txt v="heading" header>Start here</Txt>
          <Btn big id="home-needs" icon="person" label="Tell us what you need" hint="Step 1" onPress={() => app.go("needs")} />
          <Btn big kind="secondary" icon="route" label="Plan a journey" onPress={() => app.go("plan")} />
        </>
      ) : (
        <>
          <Btn big id="home-plan" icon="route" label="Plan a journey" onPress={() => app.go("plan")} />
          <Btn big kind="secondary" icon="person" label="My needs" onPress={() => app.go("needs")} />
        </>
      )}
      <Gap n={space.xs} />
      <Btn kind="secondary" icon="flag" label="Tell us about a problem" onPress={() => app.go("report")} />
      <Btn kind="secondary" icon="shield" label="Privacy and help" onPress={() => app.go("privacy")} />
      <Btn kind="secondary" icon="settings" label="Settings" onPress={() => app.go("settings")} />
      <Card>
        <TextSizeChoice />
        <Txt v="small" color={c.textMuted}>This adds to your phone's own text size setting.</Txt>
      </Card>
    </View>
  );
}
