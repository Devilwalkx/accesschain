import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { makeStyles } from "./theme";
import { storage } from "./storage";

/**
 * Text size. Android's own font-size setting is honoured by React Native automatically; this adds an
 * in-app control on top (people often do not know where the system setting is). On web, `?fontscale=2`
 * simulates a large system font for automated layout tests.
 */
export type TextLevel = "normal" | "large" | "xlarge";
export const LEVEL_SCALE: Record<TextLevel, number> = { normal: 1, large: 1.25, xlarge: 1.5 };
export const LEVEL_LABEL: Record<TextLevel, string> = { normal: "Normal text", large: "Large text", xlarge: "Extra large text" };
const KEY = "ac.textsize";

function testScale(): number {
  if (typeof window === "undefined" || !window.location?.search) return 1;
  const m = /[?&]fontscale=(\d(?:\.\d)?)/.exec(window.location.search);
  const v = m ? Number(m[1]) : 1;
  return v >= 1 && v <= 3 ? v : 1;
}

interface Ctx {
  level: TextLevel;
  setLevel: (l: TextLevel) => void;
  k: number;
}
const TextCtx = createContext<Ctx>({ level: "normal", setLevel: () => {}, k: 1 });

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = useState<TextLevel>("normal");
  useEffect(() => {
    storage.get(KEY).then((v) => {
      if (v === "normal" || v === "large" || v === "xlarge") setLevelState(v);
    }).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      level,
      k: LEVEL_SCALE[level] * testScale(),
      setLevel: (l) => {
        setLevelState(l);
        storage.set(KEY, l).catch(() => {});
      }
    }),
    [level]
  );
  return <TextCtx.Provider value={value}>{children}</TextCtx.Provider>;
}

export const useTextSize = () => useContext(TextCtx);
export function useS() {
  const { k } = useContext(TextCtx);
  return makeStyles(k);
}
