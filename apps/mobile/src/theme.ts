import { StyleSheet } from "react-native";

/**
 * Senior-friendly styles. Everything scales with `k` (in-app text size x any simulated/system scale).
 * Buttons never have a fixed height or line limit, so large text wraps instead of overlapping.
 * Contrast: text #111 and accent #0b3d91 on white are both above 7:1.
 */
export const colors = {
  bg: "#f3f6fb",
  card: "#ffffff",
  text: "#111111",
  muted: "#333333",
  border: "#555555",
  accent: "#0b3d91",
  warnBg: "#fff4cc",
  warnBorder: "#8a6d00",
  fitBg: "#e3f3e6",
  fitBorder: "#1b5e20",
  barrierBg: "#fbe4e1",
  barrierBorder: "#8b0000",
  unknownBg: "#fff4cc"
};

const cache = new Map<number, ReturnType<typeof build>>();

function build(k: number) {
  const f = (n: number) => Math.round(n * k);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    wordmark: { fontSize: f(34), lineHeight: f(42), fontWeight: "800", color: colors.accent, letterSpacing: -0.5 },
    content: { padding: 20, paddingBottom: 32 },
    h1: { fontSize: f(28), lineHeight: f(36), fontWeight: "700", color: colors.text, marginBottom: 8 },
    h2: { fontSize: f(22), lineHeight: f(30), fontWeight: "700", color: colors.text, marginTop: 20, marginBottom: 6 },
    p: { fontSize: f(18), lineHeight: f(26), color: colors.text, marginVertical: 6 },
    muted: { fontSize: f(16), lineHeight: f(23), color: colors.muted, marginVertical: 4 },
    banner: { backgroundColor: colors.warnBg, borderColor: colors.warnBorder, borderWidth: 2, borderRadius: 12, padding: 10, marginBottom: 14 },
    bannerText: { fontSize: f(16), lineHeight: f(22), color: colors.text, fontWeight: "600" },
    button: { minHeight: 56, justifyContent: "center", paddingVertical: 14, paddingHorizontal: 18, borderWidth: 2, borderColor: colors.accent, borderRadius: 16, marginVertical: 6, backgroundColor: colors.card },
    buttonPrimary: { backgroundColor: colors.accent },
    buttonDanger: { borderColor: colors.barrierBorder },
    buttonText: { fontSize: f(20), lineHeight: f(27), color: colors.accent, fontWeight: "700", textAlign: "left", flexShrink: 1 },
    buttonTextPrimary: { color: "#ffffff" },
    buttonTextDanger: { color: colors.barrierBorder },
    homeButton: { minHeight: 72 },
    toggleRow: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderWidth: 2, borderColor: "#c3cde0", borderRadius: 16, backgroundColor: colors.card, marginVertical: 5 },
    toggleBox: { fontSize: f(30), lineHeight: f(34), color: colors.accent, width: f(40) },
    toggleCol: { flex: 1, flexShrink: 1, minWidth: 0 },
    toggleText: { fontSize: f(18), lineHeight: f(25), color: colors.text, flexShrink: 1 },
    toggleState: { fontSize: f(16), lineHeight: f(22), fontWeight: "700", color: colors.accent, marginTop: 2 },
    input: { minHeight: 56, borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, fontSize: f(18), color: colors.text, marginVertical: 6 },
    card: { borderWidth: 1, borderColor: "#d5ddea", borderRadius: 20, backgroundColor: colors.card, padding: 18, marginVertical: 10, shadowColor: "#0b3d91", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    status: { borderWidth: 3, borderRadius: 16, padding: 14, marginVertical: 8 },
    statusTitle: { fontSize: f(22), lineHeight: f(30), fontWeight: "800", color: colors.text },
    statusBody: { fontSize: f(18), lineHeight: f(26), color: colors.text, marginTop: 4 },
    mono: { fontSize: f(16), lineHeight: f(24), color: colors.text },
    confirm: { borderWidth: 3, borderColor: colors.barrierBorder, borderRadius: 20, padding: 16, marginVertical: 12, backgroundColor: colors.card }
  });
}

export function makeStyles(k: number) {
  const key = Math.round(k * 100) / 100;
  let s = cache.get(key);
  if (!s) {
    s = build(key);
    cache.set(key, s);
  }
  return s;
}
