import React from "react";
import { Pressable, Text, View } from "react-native";
import { SYNTHETIC_NOTICE } from "@accesschain/core";
import { s } from "./theme";

export function SyntheticBanner() {
  return (
    <View style={s.banner} accessible accessibilityRole="alert">
      <Text style={s.bannerText}>{SYNTHETIC_NOTICE} Fictional places only.</Text>
    </View>
  );
}

export function Button(props: { label: string; onPress: () => void; selected?: boolean; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ selected: !!props.selected }}
      onPress={props.onPress}
      style={[s.button, props.selected && s.buttonSelected]}
    >
      <Text style={[s.buttonText, props.selected && s.buttonTextSelected]}>{props.label}</Text>
    </Pressable>
  );
}
