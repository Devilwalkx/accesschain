import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { RequirementsProfile } from "@accesschain/core";
import { installSecureRandom } from "./src/secureRandom";
import { platformBlocker } from "./src/platformCheck";
import { expoKeyStore } from "./src/keystore";
import { ProfileRepo } from "./src/profileRepo";
import { PlanScreen } from "./src/screens/PlanScreen";
import { NeedsScreen } from "./src/screens/NeedsScreen";
import { ReportScreen } from "./src/screens/ReportScreen";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { Button } from "./src/ui";
import { s } from "./src/theme";

type Tab = "plan" | "needs" | "report" | "privacy";
const TABS: Array<[Tab, string]> = [["plan", "Plan"], ["needs", "Needs"], ["report", "Report"], ["privacy", "Privacy"]];

let randomError: string | null = platformBlocker();
if (!randomError) {
  try {
    installSecureRandom();
  } catch (e) {
    randomError = e instanceof Error ? e.message : "Secure random unavailable";
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("plan");
  const [profile, setProfile] = useState<RequirementsProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Local demo account id; a real build derives this from the authenticated account.
  const repo = useMemo(() => new ProfileRepo(expoKeyStore, "local-demo-account"), []);

  useEffect(() => {
    if (randomError) return;
    repo.load().then(setProfile).catch(() => setLoadError("Your saved requirements could not be opened on this device. Recovery may be needed."));
  }, [repo]);

  if (randomError) {
    return (
      <SafeAreaView style={s.screen}>
        <Text style={s.h1} accessibilityRole="header">Cannot start safely</Text>
        <Text style={s.p}>Private storage is disabled on this device: {randomError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {loadError && <Text style={s.p} accessibilityRole="alert">{loadError}</Text>}
      <View style={{ flex: 1 }}>
        {tab === "plan" && <PlanScreen profile={profile} onSetNeeds={() => setTab("needs")} />}
        {tab === "needs" && <NeedsScreen profile={profile} onSave={async (p) => { await repo.save(p); setProfile(p); }} onSaved={() => setTab("plan")} />}
        {tab === "report" && <ReportScreen />}
        {tab === "privacy" && <PrivacyScreen repo={repo} onErased={() => setProfile(null)} />}
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", paddingHorizontal: 4 }}>
        {TABS.map(([id, text]) => (
          <View key={id} style={{ flex: 1, minWidth: 0 }}>
            <Button role="tab" label={text} selected={tab === id} onPress={() => setTab(id)} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
