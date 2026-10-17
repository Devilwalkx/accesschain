import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Text, View } from "react-native";
import { SafeAreaInsetsContext, SafeAreaProvider, SafeAreaView, initialWindowMetrics, type EdgeInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { RequirementsProfile } from "@accesschain/core";
import { installSecureRandom } from "./src/secureRandom";
import { platformBlocker } from "./src/platformCheck";
import { expoKeyStore } from "./src/keystore";
import { ProfileRepo } from "./src/profileRepo";
import { PlanFlow } from "./src/screens/PlanFlow";
import { LiveModeProvider } from "./src/live";
import { NeedsScreen } from "./src/screens/NeedsScreen";
import { ReportScreen } from "./src/screens/ReportScreen";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { TextSizeProvider, useS } from "./src/settings";
import { HomeScreen } from "./src/screens/HomeScreen";

type Screen = "home" | "plan" | "needs" | "report" | "privacy";

let randomError: string | null = platformBlocker();
if (!randomError) {
  try {
    installSecureRandom();
  } catch (e) {
    randomError = e instanceof Error ? e.message : "Secure random unavailable";
  }
}

/**
 * Android draws edge-to-edge, so the status bar and the navigation bar (3-button or gesture) overlap
 * the app unless we pad by the real system insets. React Native's own SafeAreaView does nothing on
 * Android; this library does. On web, `?insets=<top>,<bottom>` simulates insets for automated tests.
 */
function testInsets(): EdgeInsets | undefined {
  if (typeof window === "undefined" || !window.location?.search) return undefined;
  const m = /[?&]insets=(\d{1,3}),(\d{1,3})/.exec(window.location.search);
  return m ? { top: Number(m[1]), bottom: Number(m[2]), left: 0, right: 0 } : undefined;
}

export default function App() {
  const simulated = testInsets();
  // Simulated insets bypass the provider because on web it re-measures from CSS and would overwrite them.
  if (simulated) {
    return (
      <SafeAreaInsetsContext.Provider value={simulated}>
        <Root />
      </SafeAreaInsetsContext.Provider>
    );
  }
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  return (
    <TextSizeProvider>
      <LiveModeProvider>
        <Shell />
      </LiveModeProvider>
    </TextSizeProvider>
  );
}

function Shell() {
  const s = useS();
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<RequirementsProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Local demo account id; a real build derives this from the authenticated account.
  const repo = useMemo(() => new ProfileRepo(expoKeyStore, "local-demo-account"), []);
  const home = () => setScreen("home");

  useEffect(() => {
    if (randomError) return;
    repo.load().then(setProfile).catch(() => setLoadError("Your saved answers could not be opened on this phone. Recovery may be needed."));
  }, [repo]);

  // Android back button: go to Home first, then leave the app.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen !== "home") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  if (randomError) {
    return (
      <SafeAreaView style={s.screen} edges={["top", "bottom", "left", "right"]}>
        <View style={s.content}>
          <Text style={s.h1} accessibilityRole="header">Cannot start safely</Text>
          <Text style={s.p}>Private storage is disabled on this device: {randomError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />
      {loadError && <Text style={s.p} accessibilityRole="alert">{loadError}</Text>}
      {screen === "home" && <HomeScreen hasNeeds={!!profile} go={setScreen} />}
      {screen === "plan" && <PlanFlow profile={profile} onHome={home} onNeeds={() => setScreen("needs")} />}
      {screen === "needs" && (
        <NeedsScreen profile={profile} onHome={home} onSave={async (p) => { await repo.save(p); setProfile(p); }} onSaved={() => setScreen("plan")} />
      )}
      {screen === "report" && <ReportScreen onHome={home} />}
      {screen === "privacy" && <PrivacyScreen repo={repo} onHome={home} onErased={() => setProfile(null)} />}
    </SafeAreaView>
  );
}
