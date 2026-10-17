/**
 * Design tokens. Pure data (no React Native imports) so contrast can be unit-tested.
 * Identity (AccessChain): strong blue on cool paper, built for older readers: larger type, 56 dp targets, 7:1 contrast for every text colour. Status is never colour alone: every status also carries an icon and words.
 * 
 */
export interface Palette {
  bg: string; surface: string; surfaceAlt: string; line: string;
  text: string; textMuted: string;
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  okBg: string; okText: string; okIcon: string;
  warnBg: string; warnText: string; warnIcon: string;
  badBg: string; badText: string; badIcon: string;
  dangerSolid: string; onDangerSolid: string;
  infoBg: string; infoText: string;
  scrim: string; inputBorder: string; placeholder: string;
}

export const light: Palette = {
  bg: "#F3F6FB", surface: "#FFFFFF", surfaceAlt: "#E6ECF6", line: "#7C879B",
  text: "#0A0F1A", textMuted: "#2F3745",
  primary: "#0B3D91", onPrimary: "#FFFFFF", primaryContainer: "#DCE6F8", onPrimaryContainer: "#0A2A63",
  okBg: "#DDF2E3", okText: "#0B3B19", okIcon: "#146C2E",
  warnBg: "#FFF1BF", warnText: "#3F2D00", warnIcon: "#7A4E00",
  badBg: "#FBE1E1", badText: "#5C1010", badIcon: "#A12020",
  dangerSolid: "#8E1B1B", onDangerSolid: "#FFFFFF",
  infoBg: "#E4EBF5", infoText: "#1B3556",
  scrim: "rgba(10,14,20,0.55)", inputBorder: "#6B717C", placeholder: "#4A505B"
};

export const dark: Palette = {
  bg: "#0B0F16", surface: "#161B24", surfaceAlt: "#212836", line: "#6B768C",
  text: "#F2F5FA", textMuted: "#C3CBD9",
  primary: "#A9C4EE", onPrimary: "#0B1B33", primaryContainer: "#27364F", onPrimaryContainer: "#D6E4FA",
  okBg: "#17331F", okText: "#C4EDCF", okIcon: "#7FD99A",
  warnBg: "#3A2E0B", warnText: "#F6DE9A", warnIcon: "#F0C45A",
  badBg: "#431919", badText: "#F7C9C9", badIcon: "#F59A9A",
  dangerSolid: "#F2A0A0", onDangerSolid: "#3A0A0A",
  infoBg: "#1E2A3E", infoText: "#C9DBF5",
  scrim: "rgba(0,0,0,0.65)", inputBorder: "#8C95A6", placeholder: "#A2ABBB"
};

/** 4-pt base scale. */
export const space = { xxs: 4, xs: 8, s: 12, m: 16, l: 24, xl: 32 } as const;
export const radius = { s: 10, m: 14, l: 20, pill: 999 } as const;
/** Minimum touch target (dp). Larger than the usual 48 dp because this app is made for older readers. */
export const TOUCH = 56;

export type Variant = "display" | "title" | "heading" | "body" | "small" | "label";
/** sp sizes. Body is 18sp with 1.5 line height; nothing is smaller than 16sp. */
export const type: Record<Variant, { size: number; line: number; weight: "400" | "600" | "700" }> = {
  display: { size: 32, line: 40, weight: "700" },
  title: { size: 28, line: 36, weight: "700" },
  heading: { size: 22, line: 30, weight: "700" },
  body: { size: 18, line: 27, weight: "400" },
  small: { size: 16, line: 24, weight: "400" },
  label: { size: 16, line: 24, weight: "700" }
};

// ---- WCAG contrast (used by the unit test)
function lin(c: number) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
/** Foreground/background pairs that must be at least `min`:1. */
export function requiredPairs(p: Palette): Array<{ name: string; fg: string; bg: string; min: number }> {
  return [
    { name: "text on bg", fg: p.text, bg: p.bg, min: 7 },
    { name: "text on surface", fg: p.text, bg: p.surface, min: 7 },
    { name: "muted on bg", fg: p.textMuted, bg: p.bg, min: 7 },
    { name: "muted on surface", fg: p.textMuted, bg: p.surface, min: 7 },
    { name: "muted on surfaceAlt", fg: p.textMuted, bg: p.surfaceAlt, min: 7 },
    { name: "onPrimary on primary", fg: p.onPrimary, bg: p.primary, min: 7 },
    { name: "primary text on bg", fg: p.primary, bg: p.bg, min: 7 },
    { name: "primary text on surface", fg: p.primary, bg: p.surface, min: 7 },
    { name: "onContainer on container", fg: p.onPrimaryContainer, bg: p.primaryContainer, min: 7 },
    { name: "ok text", fg: p.okText, bg: p.okBg, min: 7 },
    { name: "warn text", fg: p.warnText, bg: p.warnBg, min: 7 },
    { name: "bad text", fg: p.badText, bg: p.badBg, min: 7 },
    { name: "info text", fg: p.infoText, bg: p.infoBg, min: 7 },
    { name: "ok icon on ok bg", fg: p.okIcon, bg: p.okBg, min: 3 },
    { name: "warn icon on warn bg", fg: p.warnIcon, bg: p.warnBg, min: 3 },
    { name: "bad icon on bad bg", fg: p.badIcon, bg: p.badBg, min: 3 },
    { name: "danger button text", fg: p.onDangerSolid, bg: p.dangerSolid, min: 7 },
    { name: "input border on surface", fg: p.inputBorder, bg: p.surface, min: 3 },
    { name: "placeholder on surface", fg: p.placeholder, bg: p.surface, min: 7 },
    { name: "line on bg (non-text)", fg: p.line, bg: p.bg, min: 3 },
    { name: "line on surface (non-text)", fg: p.line, bg: p.surface, min: 3 },
    { name: "text on surfaceAlt", fg: p.text, bg: p.surfaceAlt, min: 7 }
  ];
}
