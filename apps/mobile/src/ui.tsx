import React from "react";
import { Pressable, Text, View } from "react-native";
import { useS } from "./settings";
import { useLive } from "./live";

export function SyntheticBanner({ text }: { text?: string }) {
  const s = useS();
  return (
    <View style={s.banner} accessible accessibilityRole="alert">
      <Text style={s.bannerText}>{text ?? "Demonstration only. The places and information are made up."}</Text>
    </View>
  );
}

/** Tells the person which kind of information they are looking at. Nothing before they choose. */
export function ModeBanner() {
  const { mode } = useLive();
  if (mode === "unset") return null;
  return mode === "demo" ? (
    <SyntheticBanner />
  ) : (
    <SyntheticBanner text="Live information from TfL and OpenStreetMap. Notes written by the public can be out of date." />
  );
}

type Variant = "secondary" | "primary" | "danger";

/**
 * `selected` makes the button one choice in a group (role "radio"); `expanded` marks a button that
 * reveals more content. State is exposed with real aria-* props so TalkBack/VoiceOver announce it.
 */
export function Button(props: { label: string; onPress: () => void; variant?: Variant; selected?: boolean; expanded?: boolean; hint?: string; big?: boolean }) {
  const s = useS();
  const v = props.variant ?? "secondary";
  const filled = v === "primary" || !!props.selected;
  return (
    <Pressable
      role={props.selected !== undefined ? "radio" : "button"}
      aria-checked={props.selected !== undefined ? props.selected : undefined}
      aria-expanded={props.expanded}
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      onPress={props.onPress}
      style={[s.button, props.big && s.homeButton, v === "danger" && s.buttonDanger, filled && s.buttonPrimary]}
    >
      <Text style={[s.buttonText, v === "danger" && s.buttonTextDanger, filled && s.buttonTextPrimary]}>
        {props.selected ? "✔ " : ""}
        {props.label}
      </Text>
    </Pressable>
  );
}

/** One big tappable row: the whole row toggles, and the state is written in words as well as a box. */
export function ToggleRow(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const s = useS();
  return (
    <Pressable
      role="switch"
      aria-checked={props.value}
      accessibilityLabel={props.label}
      onPress={() => props.onChange(!props.value)}
      style={s.toggleRow}
    >
      <Text style={s.toggleBox}>{props.value ? "☑" : "☐"}</Text>
      <View style={s.toggleCol}>
        <Text style={s.toggleText}>{props.label}</Text>
        <Text style={s.toggleState}>{props.value ? "Yes" : "No"}</Text>
      </View>
    </Pressable>
  );
}

export function BackBar({ onHome }: { onHome: () => void }) {
  return <Button label="‹ Back to home" onPress={onHome} />;
}

export type StatusKind = "fit" | "barrier" | "unknown";
const SYMBOL: Record<StatusKind, string> = { fit: "✔", barrier: "✖", unknown: "?" };

export function StatusBox(props: { kind: StatusKind; title: string; body: string }) {
  const s = useS();
  const palette =
    props.kind === "fit"
      ? { backgroundColor: "#e3f3e6", borderColor: "#1b5e20" }
      : props.kind === "barrier"
        ? { backgroundColor: "#fbe4e1", borderColor: "#8b0000" }
        : { backgroundColor: "#fff4cc", borderColor: "#8a6d00" };
  return (
    <View style={[s.status, palette]}>
      <Text style={s.statusTitle} accessibilityRole="header">
        {SYMBOL[props.kind]} {props.title}
      </Text>
      <Text style={s.statusBody}>{props.body}</Text>
    </View>
  );
}

/** Two big buttons that restate exactly what will happen. */
export function ConfirmCard(props: { question: string; yes: string; no: string; onYes: () => void; onNo: () => void }) {
  const s = useS();
  return (
    <View style={s.confirm} accessibilityRole="alert">
      <Text style={s.h2}>{props.question}</Text>
      <Button label={props.yes} variant="danger" onPress={props.onYes} />
      <Button label={props.no} variant="primary" onPress={props.onNo} />
    </View>
  );
}
