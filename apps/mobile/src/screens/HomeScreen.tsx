import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, ModeBanner } from "../ui";
import { LEVEL_LABEL, useS, useTextSize, type TextLevel } from "../settings";

export function HomeScreen(props: { hasNeeds: boolean; go: (screen: "plan" | "needs" | "report" | "privacy") => void }) {
  const s = useS();
  const { level, setLevel } = useTextSize();
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} accessibilityLabel="Home">
      <ModeBanner />
      <Text style={s.wordmark} accessibilityRole="header">AccessChain</Text>
      <Text style={s.p}>Find out if you can get there, before you set off.</Text>

      {!props.hasNeeds ? (
        <>
          <Text style={s.h2} accessibilityRole="header">Start here</Text>
          <Button big variant="primary" label="Tell us what you need" onPress={() => props.go("needs")} hint="Step 1" />
          <Button big label="Plan a journey" onPress={() => props.go("plan")} />
        </>
      ) : (
        <>
          <Button big variant="primary" label="Plan a journey" onPress={() => props.go("plan")} />
          <Button big label="My needs" onPress={() => props.go("needs")} />
        </>
      )}
      <Button big label="Tell us about a problem" onPress={() => props.go("report")} />
      <Button big label="Privacy and help" onPress={() => props.go("privacy")} />

      <View style={s.card}>
        <Text style={s.h2} accessibilityRole="header">Text size</Text>
        {(["normal", "large", "xlarge"] as TextLevel[]).map((l) => (
          <Button key={l} label={LEVEL_LABEL[l]} selected={level === l} onPress={() => setLevel(l)} />
        ))}
      </View>
    </ScrollView>
  );
}
