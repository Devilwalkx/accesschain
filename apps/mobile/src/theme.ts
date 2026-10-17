// Back-compat shim: the real tokens live in ./design/tokens.ts and colours come from useTheme().
export { space, radius, TOUCH } from "./design/tokens";
export type TextSize = "normal" | "large" | "xl";
/** In-app text size multiplies on top of the Android system font scale (which is never disabled). Default 1. */
export const TEXT_FACTOR: Record<TextSize, number> = { normal: 1, large: 1.2, xl: 1.4 };
