import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, AccessibilityInfo, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, findNodeHandle, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./design/Icon";
import { useReducedMotion, useTheme } from "./design/theme";
import { radius, space, TOUCH, type, type Variant } from "./design/tokens";
import { TEXT_FACTOR, type TextSize } from "./theme";

// ---- text scale: in-app setting x optional ?fontscale= (web tests). Android system font scale applies on top (allowFontScaling stays on).
export const TextScaleContext = createContext<number>(1);
export function useScale() { return useContext(TextScaleContext); }
export function factorFor(size: TextSize, query: number): number { return TEXT_FACTOR[size] * query; }

/** A very long word (for example "Shakespeare's") may break across lines instead of running out of its box. Android does this by itself; on web it needs the style. */
const WRAP: object = Platform.OS === "web" ? { wordBreak: "break-word", overflowWrap: "anywhere" } : {};

type Legacy = "h1" | "h2";
const alias: Record<Legacy, Variant> = { h1: "title", h2: "heading" };

export function Txt(p: { v?: Variant | Legacy; children: React.ReactNode; color?: string; style?: StyleProp<TextStyle>; header?: boolean; selectable?: boolean; label?: string; live?: boolean; align?: "left" | "center" | "right" }) {
  const f0 = useScale();
  const c = useTheme();
  const v: Variant = p.v ? (alias[p.v as Legacy] ?? (p.v as Variant)) : "body";
  // Display figures are already large: cap their growth so an amount never breaks across lines.
  const f = v === "display" ? Math.min(f0, 1.25) : v === "title" ? Math.min(f0, 1.5) : f0;
  const t = type[v];
  return (
    <Text
      accessibilityRole={p.header ? "header" : undefined}
      accessibilityLabel={p.label}
      accessibilityLiveRegion={p.live ? "polite" : undefined}
      selectable={p.selectable}
      // The big headline sizes may stop growing with the phone's text size (a 32 sp word at 200% would break in the middle); body text always follows it.
      maxFontSizeMultiplier={v === "display" ? 1.3 : v === "title" ? 1.6 : undefined}
      style={[{ color: p.color ?? c.text, fontSize: t.size * f, lineHeight: t.line * f, fontWeight: t.weight, textAlign: p.align }, WRAP, p.style]}
    >{p.children}</Text>
  );
}

export function Gap({ n = space.m }: { n?: number }) { return <View style={{ height: n }} />; }

export type Tone = "info" | "ok" | "wait" | "bad";
function toneColors(c: ReturnType<typeof useTheme>, tone: Tone) {
  return tone === "ok" ? { bg: c.okBg, fg: c.okText, icon: c.okIcon, name: "ok" as IconName }
    : tone === "wait" ? { bg: c.warnBg, fg: c.warnText, icon: c.warnIcon, name: "wait" as IconName }
    : tone === "bad" ? { bg: c.badBg, fg: c.badText, icon: c.badIcon, name: "warn" as IconName }
    : { bg: c.infoBg, fg: c.infoText, icon: c.infoText, name: "info" as IconName };
}

export function Card({ children, tone, style, accessibilityLabel }: { children: React.ReactNode; tone?: Tone; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const c = useTheme();
  const bg = tone ? toneColors(c, tone).bg : c.surface;
  return <View accessibilityLabel={accessibilityLabel} style={[{ backgroundColor: bg, borderRadius: radius.l, padding: space.m, marginBottom: space.m, borderWidth: 1, borderColor: tone ? "transparent" : c.line }, style]}>{children}</View>;
}

export type ButtonKind = "primary" | "secondary" | "quiet" | "danger";
export function Btn(p: { label: string; onPress: () => void; kind?: ButtonKind; selected?: boolean; hint?: string; role?: "button" | "radio" | "checkbox"; disabled?: boolean; icon?: IconName; id?: string; big?: boolean; align?: "center" | "left" }) {
  const c = useTheme();
  const f = useScale();
  const kind = p.kind ?? "primary";
  const filled = kind === "primary" || kind === "danger" || (!!p.selected && p.role === "radio");
  const bg = p.selected && p.role === "radio" ? c.primary : kind === "primary" ? c.primary : kind === "danger" ? c.dangerSolid : "transparent";
  const fg = kind === "danger" ? c.onDangerSolid : filled ? c.onPrimary : c.primary;
  const press = () => p.onPress();
  return (
    <Pressable
      testID={p.id}
      accessibilityRole={p.role ?? "button"}
      accessibilityLabel={p.label}
      accessibilityHint={p.hint}
      accessibilityState={{ selected: p.role ? undefined : !!p.selected, checked: p.role ? !!p.selected : undefined, disabled: !!p.disabled }}
      aria-checked={p.role ? !!p.selected : undefined}
      disabled={p.disabled}
      onPress={press}
      android_ripple={{ color: c.line, borderless: false }}
      style={({ pressed }) => [{
        minHeight: p.big ? 76 : TOUCH + 6, paddingVertical: p.big ? 16 : 12, paddingHorizontal: space.m, borderRadius: radius.m, backgroundColor: bg,
        flexDirection: "row", justifyContent: p.align === "left" ? "flex-start" : "center", alignItems: "center", marginBottom: space.s, opacity: p.disabled ? 0.45 : pressed ? 0.85 : 1, gap: 10
      }, (kind === "secondary" && !(p.selected && p.role === "radio")) ? { borderWidth: 3, borderColor: c.primary } : null]}
    >
      {p.icon ? <Icon name={p.icon} size={(p.big ? 28 : 24) * Math.min(f, 1.5)} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: (p.big ? 20 : type.body.size) * f, lineHeight: (p.big ? 27 : 25) * f, fontWeight: "700", textAlign: p.align === "left" ? "left" : "center", flexShrink: 1, ...WRAP }}>{p.label}</Text>
    </Pressable>
  );
}

/** Square 48 dp icon-only button; the label is read by TalkBack and is the web aria-label. */
export function IconBtn({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: c.line, borderless: true, radius: 26 }}
      style={({ pressed }) => ({ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center", borderRadius: TOUCH / 2, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={24} color={color ?? c.text} />
    </Pressable>
  );
}

/** Status: icon + words (never colour alone). */
export function Chip({ tone, text }: { tone: Tone; text: string }) {
  const c = useTheme();
  const t = toneColors(c, tone);
  const icon: IconName = tone === "ok" ? "ok" : tone === "bad" ? "bad" : tone === "wait" ? "wait" : "info";
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "flex-start", backgroundColor: t.bg, borderRadius: radius.m, paddingHorizontal: space.s, paddingVertical: 6, marginVertical: 3, gap: 8, maxWidth: "100%" }}>
      <View style={{ paddingTop: 2 }}><Icon name={icon} size={18} color={t.icon} /></View>
      <View style={{ flexShrink: 1 }}><Txt v="label" color={t.fg}>{text}</Txt></View>
    </View>
  );
}

export function Field(p: { label: string; value: string; onChange: (t: string) => void; multiline?: boolean; keyboard?: "default" | "numeric"; autoCapitalize?: "none" | "characters"; placeholder?: string; help?: string; error?: string | null; onSubmit?: () => void }) {
  const c = useTheme();
  const f = useScale();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: space.m }}>
      <Txt v="label">{p.label}</Txt>
      {p.help ? <Txt v="small" color={c.textMuted}>{p.help}</Txt> : null}
      <TextInput
        testID={`field-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
        accessibilityLabel={p.label}
        value={p.value}
        onChangeText={p.onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        multiline={p.multiline}
        keyboardType={p.keyboard === "numeric" ? "decimal-pad" : "default"}
        returnKeyType={p.multiline ? "default" : "done"}
        autoCapitalize={p.autoCapitalize ?? "sentences"}
        autoCorrect={false}
        blurOnSubmit={!p.multiline}
        onSubmitEditing={p.onSubmit}
        placeholder={p.placeholder}
        placeholderTextColor={c.placeholder}
        style={{ minHeight: p.multiline ? 120 : TOUCH + 6, backgroundColor: c.surface, borderRadius: radius.m, borderWidth: focus || p.error ? 3 : 2, borderColor: p.error ? c.badIcon : focus ? c.primary : c.inputBorder, paddingHorizontal: space.s, paddingVertical: 10, fontSize: type.body.size * f, color: c.text, marginTop: 4, textAlignVertical: p.multiline ? "top" : "center" }}
      />
      {p.error ? <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={{ flexDirection: "row", gap: 6, marginTop: 4, alignItems: "flex-start" }}><View style={{ paddingTop: 2 }}><Icon name="warn" size={18} color={c.badIcon} /></View><View style={{ flexShrink: 1 }}><Txt v="small" color={c.badText} style={{ fontWeight: "600" }}>{p.error}</Txt></View></View> : null}
    </View>
  );
}

/**
 * A modal dialog. Back (system or Escape) = "No". Focus moves to the title when it opens and returns to the control that opened it.
 * Both choices are real buttons; nothing needs a swipe.
 */
export function ConfirmCard(p: { title: string; body: string; yes: string; no: string; onYes: () => void; onNo: () => void; danger?: boolean; extra?: React.ReactNode }) {
  const c = useTheme();
  const titleRef = useRef<any>(null);
  const opener = useRef<unknown>(null);
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") opener.current = document.activeElement;
    const t = setTimeout(() => {
      if (Platform.OS === "web") (titleRef.current as unknown as HTMLElement | null)?.focus?.();
      else { const h = findNodeHandle(titleRef.current); if (h) AccessibilityInfo.setAccessibilityFocus(h); }
    }, 60);
    return () => { clearTimeout(t); if (Platform.OS === "web") (opener.current as HTMLElement | null)?.focus?.(); };
  }, []);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={p.onNo} statusBarTranslucent>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: c.scrim, justifyContent: "center", padding: space.m }}>
        <View style={{ maxHeight: "92%", backgroundColor: c.surface, borderRadius: radius.l, borderWidth: 1, borderColor: c.line }}>
          <ScrollView contentContainerStyle={{ padding: space.m }} keyboardShouldPersistTaps="handled">
            <Text ref={titleRef} accessibilityRole="header" {...(Platform.OS === "web" ? ({ tabIndex: -1 } as object) : { accessible: true, focusable: true })} style={{ color: c.text, fontSize: type.heading.size * 1.0, fontWeight: "700", lineHeight: type.heading.line, marginBottom: space.xs }}>{p.title}</Text>
            <Txt>{p.body}</Txt>
            {p.extra}
            <Gap n={space.s} />
            <Btn label={p.yes} kind={p.danger ? "danger" : "primary"} onPress={p.onYes} />
            <Btn label={p.no} kind="secondary" onPress={p.onNo} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Notice({ text, tone = "info" }: { text: string; tone?: Tone }) {
  const c = useTheme();
  const t = toneColors(c, tone);
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: space.xs, backgroundColor: t.bg, borderRadius: radius.m, padding: space.s, marginBottom: space.m, alignItems: "flex-start" }}>
      <View style={{ paddingTop: 2 }}><Icon name={tone === "ok" ? "ok" : tone === "bad" ? "warn" : tone === "wait" ? "wait" : "info"} size={20} color={t.icon} /></View>
      <View style={{ flexShrink: 1 }}><Txt v="small" color={t.fg}>{text}</Txt></View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: space.l, paddingHorizontal: space.s }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryContainer, alignItems: "center", justifyContent: "center", marginBottom: space.s }}><Icon name={icon} size={28} color={c.onPrimaryContainer} /></View>
      <Txt v="heading" align="center" header>{title}</Txt>
      <Txt color={c.textMuted} align="center">{body}</Txt>
      {action ? <View style={{ alignSelf: "stretch", marginTop: space.m }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ text }: { text: string }) {
  const c = useTheme();
  return <View accessibilityRole="progressbar" accessibilityLabel={text} accessibilityLiveRegion="polite" style={{ padding: space.l, alignItems: "center" }}><Txt color={c.textMuted}>{text}</Txt></View>;
}

/** Persistent banner for the demonstration environment and synthetic data. Used only when the project is a demo. */
export function DemoStrip({ text }: { text?: string }) {
  const c = useTheme();
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 8, backgroundColor: c.warnBg, borderRadius: radius.m, paddingHorizontal: space.s, paddingVertical: 8, marginBottom: space.m, alignItems: "flex-start" }}>
      <View style={{ paddingTop: 2 }}><Icon name="info" size={18} color={c.warnIcon} /></View>
      <View style={{ flexShrink: 1 }}><Txt v="small" color={c.warnText}>{text ?? "Demonstration. Made-up names and prices. Not legal advice."}</Txt></View>
    </View>
  );
}

/** One big tappable row. The state is written in words (Yes / No) and shown with a tick, never colour alone. */
export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} aria-checked={on}
      onPress={() => onChange(!on)} android_ripple={{ color: c.line }}
      style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: space.s, paddingVertical: 10, paddingHorizontal: space.m, borderWidth: 3, borderColor: on ? c.primary : c.line, borderRadius: radius.m, backgroundColor: on ? c.primaryContainer : c.surface, marginBottom: space.s }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 3, borderColor: c.primary, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.primary : c.surface }}>
        {on ? <Icon name="ok" size={26} color={c.onPrimary} /> : null}
      </View>
      <View style={{ flex: 1, flexShrink: 1 }}>
        <Txt>{label}</Txt>
        <Txt v="label" color={c.primary}>{on ? "Yes" : "No"}</Txt>
      </View>
    </Pressable>
  );
}

export function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const c = useTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)}
        style={{ minHeight: TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.xs, gap: 8 }}>
        <View style={{ flexShrink: 1 }}><Txt v="label" color={c.primary}>{title}</Txt></View>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}><Icon name="chevron" size={22} color={c.primary} /></View>
      </Pressable>
      {open ? <Card>{children}</Card> : null}
    </View>
  );
}

export function Row({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  // The value never breaks across lines: at large text sizes it drops under its label instead.
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", paddingVertical: 4, columnGap: 12 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 140 }}><Txt v={bold ? "heading" : "body"}>{left}</Txt></View>
      <View style={{ flexShrink: 0, marginLeft: "auto" }}><Txt v={bold ? "heading" : "body"} align="right">{right}</Txt></View>
    </View>
  );
}

/** Subtle screen transition: fade + 8 px rise. Skipped when the user asked for reduced motion. */
export function Transition({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const a = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { a.setValue(1); return; }
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
  }, [id, reduce, a]);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}
