import React, { useState } from "react";
import { View } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { encryptionSelfCheck, type SelfCheckResult } from "@accesschain/core";
import { expoKeyStore } from "../keystore";
import { useApp } from "../store";
import { useLive } from "../live";
import { useTheme, useThemeMode, type ThemePref } from "../design/theme";
import type { TextSize } from "../theme";
import { Btn, Card, Gap, Notice, Txt } from "../ui";

export function buildInfo() {
  const x = (Constants.expoConfig?.extra ?? {}) as { commit?: string; builtAt?: string; channel?: string };
  return {
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "dev",
    code: Application.nativeBuildVersion ?? "web",
    id: Application.applicationId ?? "web build",
    commit: x.commit ?? "local",
    builtAt: x.builtAt ?? "",
    channel: x.channel ?? "development"
  };
}

const SIZES: Array<[TextSize, string]> = [["normal", "Normal text"], ["large", "Large text"], ["xl", "Extra large text"]];

export function TextSizeChoice() {
  const app = useApp();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Text size">
      <Txt v="heading" header>Text size</Txt>
      {SIZES.map(([id, label]) => <Btn key={id} role="radio" kind="secondary" selected={app.textSize === id} label={label} onPress={() => app.setTextSize(id)} />)}
    </View>
  );
}

export function SettingsScreen() {
  const app = useApp();
  const c = useTheme();
  const { pref } = useThemeMode();
  const { mode } = useLive();
  const info = buildInfo();
  const [check, setCheck] = useState<SelfCheckResult | "running" | null>(null);
  const themeOpts: Array<[ThemePref, string]> = [["system", "Same as phone"], ["light", "Light"], ["dark", "Dark"]];
  return (
    <View>
      <Txt v="title" header>Settings</Txt>
      <Txt v="heading" header>Display</Txt>
      <Card>
        <View accessibilityRole="radiogroup" accessibilityLabel="Theme">
          <Txt v="label">Colours</Txt>
          <Gap n={6} />
          {themeOpts.map(([id, label]) => <Btn key={id} role="radio" kind="secondary" selected={pref === id} label={label} onPress={() => app.setThemePref(id)} />)}
        </View>
        <Gap n={8} />
        <TextSizeChoice />
        <Txt v="small" color={c.textMuted}>This adds to your phone's own text size setting.</Txt>
      </Card>

      <Txt v="heading" header>Where the information comes from</Txt>
      <Card>
        <Txt>{mode === "live" ? "Live: TfL and OpenStreetMap." : mode === "demo" ? "Demonstration: made-up places." : "Not chosen yet."}</Txt>
        <Btn kind="secondary" label="Change in Privacy and help" onPress={() => app.go("privacy")} />
      </Card>

      <Txt v="heading" header>About this build</Txt>
      <Card accessibilityLabel="About this build">
        <Txt v="small">Version {info.version} (build {info.code})</Txt>
        <Txt v="small">App ID {info.id}</Txt>
        <Txt v="small">Commit {info.commit}{info.builtAt ? ` · built ${info.builtAt}` : ""}</Txt>
        <Txt v="small" color={c.textMuted}>{info.channel === "release" ? "Release build, signed with the owner's private key. Not reviewed by anyone independent. Not tested on a physical phone by its builders." : "Test build, signed with the public Android test key. Not reviewed by anyone independent. It has not been used by older or disabled users in a study, and not on a physical phone by its builders."}</Txt>
      </Card>
      <Btn kind="secondary" label="Check encryption on this phone" onPress={async () => { setCheck("running"); setCheck(await encryptionSelfCheck(expoKeyStore)); }} />
      {check === "running" ? <Notice tone="wait" text="Checking…" /> : check ? (
        <Card accessibilityLabel="Encryption check result">
          <Txt v="heading" header>{check.ok ? "Encryption check: passed" : "Encryption check: FAILED"}</Txt>
          {check.steps.map((st) => <Txt key={st.label}>{`${st.ok ? "Passed" : "Failed"}: ${st.label}`}</Txt>)}
          <Txt v="small" color={c.textMuted}>This runs the app's real encryption on made-up text. It shows none of your data and does not prove the encryption is unbreakable. Your journey lookups are not covered: they go to TfL and OpenStreetMap over HTTPS and are readable by them.</Txt>
        </Card>
      ) : null}
    </View>
  );
}
