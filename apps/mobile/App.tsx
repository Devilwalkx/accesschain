import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Keyboard, Platform, Pressable, ScrollView, Text, View, findNodeHandle } from "react-native";
import { SafeAreaInsetsContext, SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { installSecureRandom } from "./src/secureRandom";
import { platformBlocker } from "./src/platformCheck";
import { AppProvider, useApp, type Screen } from "./src/store";
import { LiveModeProvider } from "./src/live";
import { Transition, Txt, TextScaleContext, factorFor } from "./src/ui";
import { Icon } from "./src/design/Icon";
import { ThemeProvider, useTheme, useThemeMode } from "./src/design/theme";
import { TOUCH, space } from "./src/design/tokens";
import { HomeScreen } from "./src/screens/Home";
import { PlanFlow } from "./src/screens/PlanFlow";
import { NeedsScreen } from "./src/screens/Needs";
import { ReportScreen } from "./src/screens/Report";
import { PrivacyScreen } from "./src/screens/Privacy";
import { SettingsScreen } from "./src/screens/Settings";

let randomError: string | null = platformBlocker();
if (!randomError) {
  try {
    installSecureRandom();
  } catch (e) {
    randomError = e instanceof Error ? e.message : "Secure random unavailable";
  }
}

/**
 * Android draws edge-to-edge, so the status bar and navigation bar overlap the app unless we pad by the real
 * system insets. On web, `?insets=<top>,<bottom>` simulates insets for automated tests.
 */
function testInsets(): EdgeInsets | undefined {
  if (typeof window === "undefined" || !window.location?.search) return undefined;
  const m = /[?&]insets=(\d{1,3}),(\d{1,3})/.exec(window.location.search);
  return m ? { top: Number(m[1]), bottom: Number(m[2]), left: 0, right: 0 } : undefined;
}
/** `?fontscale=2` multiplies all app text (tests the large-text layout on web). */
function queryFontScale(): number {
  if (typeof window === "undefined" || !window.location?.search) return 1;
  const m = /[?&]fontscale=([0-9.]{1,4})/.exec(window.location.search);
  const v = m ? Number(m[1]) : 1;
  return v >= 0.5 && v <= 3 ? v : 1;
}

export default function App() {
  const simulated = testInsets();
  const inner = <AppProvider><Themed /></AppProvider>;
  if (simulated) return <SafeAreaInsetsContext.Provider value={simulated}>{inner}</SafeAreaInsetsContext.Provider>;
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>{inner}</SafeAreaProvider>;
}

function Themed() {
  const app = useApp();
  return (
    <ThemeProvider pref={app.themePref} setPref={app.setThemePref}>
      <LiveModeProvider><Root /></LiveModeProvider>
    </ThemeProvider>
  );
}

const TITLES: Record<Screen, string> = { home: "AccessChain", plan: "Plan a journey", needs: "Your needs", report: "Tell us about a problem", privacy: "Privacy and help", settings: "Settings" };

function Root() {
  const app = useApp();
  const c = useTheme();
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const q = useMemo(queryFontScale, []);
  const factor = factorFor(app.textSize, q);
  const scroller = useRef<any>(null);
  const titleRef = useRef<any>(null);
  const [kb, setKb] = useState(0);
  const rootH = useRef(0);
  const beforeKb = useRef(0);

  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined); }, [c.bg]);

  // System Back / predictive back gesture: unwind a sub-view, then go Home, then let the system leave the app.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => app.back());
    return () => sub.remove();
  });

  // Keyboard: if the window did not already shrink for the keyboard (edge-to-edge), pad the bottom so the focused field and its action stay visible.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      beforeKb.current = rootH.current;
      setTimeout(() => { if (rootH.current >= beforeKb.current - 4) setKb(Math.max(0, e.endCoordinates.height - insets.bottom)); }, 120);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  // After navigating, scroll to the top and move screen-reader focus to the screen title.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
    const t = setTimeout(() => {
      if (Platform.OS === "web") return;
      const h = findNodeHandle(titleRef.current);
      if (h) AccessibilityInfo.setAccessibilityFocus(h);
    }, 150);
    return () => clearTimeout(t);
  }, [app.screen, app.navNonce]);

  // A screen that swaps one view for another (place, start, result) starts the new view at the top.
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [app.scrollNonce]);

  if (randomError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: space.m }} edges={["top", "bottom", "left", "right"]}>
        <TextScaleContext.Provider value={factor}>
          <Txt v="title" header>Cannot start safely</Txt>
          <Txt>Private storage is switched off on this device: {randomError}</Txt>
        </TextScaleContext.Provider>
      </SafeAreaView>
    );
  }

  const S = app.screen;
  return (
    <TextScaleContext.Provider value={factor}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingBottom: kb }} onLayout={(e) => { rootH.current = e.nativeEvent.layout.height; }}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {/* App bar: a labelled Back button on every screen but Home */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.xs, minHeight: 64, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bg, columnGap: space.xs }}>
            {S !== "home" ? (
              <Pressable
                testID="back"
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => { app.back(); }}
                android_ripple={{ color: c.line }}
                style={{ minHeight: TOUCH, minWidth: TOUCH, flexDirection: "row", alignItems: "center", paddingHorizontal: space.xs, borderRadius: 12 }}
              >
                <Icon name="back" size={28} color={c.primary} />
                <Text maxFontSizeMultiplier={1.4} style={{ color: c.primary, fontSize: 18 * Math.min(factor, 1.4), fontWeight: "700", marginLeft: 4 }}>Back</Text>
              </Pressable>
            ) : null}
            <Text
              ref={titleRef}
              accessibilityRole="header"
              numberOfLines={2}
              style={{ flex: 1, color: c.text, fontSize: 20 * Math.min(factor, 1.4), lineHeight: 27 * Math.min(factor, 1.4), fontWeight: "700", paddingHorizontal: 4, paddingVertical: 8 }}
            >{S === "home" ? "AccessChain" : TITLES[S]}</Text>
          </View>
          <ScrollView key={`${S}-${app.navNonce}`} ref={scroller} contentContainerStyle={{ padding: space.m, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
            <Transition key={`${S}-${app.navNonce}`} id={`${S}-${app.navNonce}`}>
              {S === "home" ? <HomeScreen /> : S === "plan" ? <PlanFlow /> : S === "needs" ? <NeedsScreen /> : S === "report" ? <ReportScreen /> : S === "privacy" ? <PrivacyScreen /> : <SettingsScreen />}
            </Transition>
          </ScrollView>
        </SafeAreaView>
        <View style={{ height: kb === 0 ? insets.bottom : 0 }} />
      </View>
    </TextScaleContext.Provider>
  );
}
