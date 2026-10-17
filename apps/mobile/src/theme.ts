import { StyleSheet } from "react-native";

/** High-contrast, text-first styles. Meaning is never carried by colour alone: every state has a text label. */
export const colors = { bg: "#ffffff", text: "#111111", muted: "#444444", border: "#767676", accent: "#0b3d91", warnBg: "#fff4cc", warnBorder: "#8a6d00" };

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 16, marginBottom: 4 },
  p: { fontSize: 16, color: colors.text, marginVertical: 4, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.muted, marginVertical: 2, lineHeight: 20 },
  banner: { backgroundColor: colors.warnBg, borderColor: colors.warnBorder, borderWidth: 2, padding: 10, marginBottom: 8 },
  bannerText: { fontSize: 14, color: colors.text, fontWeight: "600" },
  button: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, borderWidth: 2, borderColor: colors.accent, marginVertical: 6 },
  buttonSelected: { backgroundColor: colors.accent },
  buttonText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  buttonTextSelected: { color: "#ffffff" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  input: { minHeight: 48, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, fontSize: 16, color: colors.text, marginVertical: 4 },
  card: { borderWidth: 1, borderColor: colors.border, padding: 12, marginVertical: 8 },
  mono: { fontSize: 14, color: colors.text, lineHeight: 20 }
});
