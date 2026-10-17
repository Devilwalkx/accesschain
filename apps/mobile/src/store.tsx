import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RequirementsProfile } from "@accesschain/core";
import { expoKeyStore } from "./keystore";
import { ProfileRepo } from "./profileRepo";
import { storage } from "./storage";
import type { TextSize } from "./theme";
import type { ThemePref } from "./design/theme";

export type Screen = "home" | "plan" | "needs" | "report" | "privacy" | "settings";
const TEXT_KEY = "ac.textsize.v2";
const THEME_KEY = "ac.theme";

interface Ctx {
  screen: Screen;
  go(s: Screen): void;
  /** Changes on every navigation, including tapping the screen you are already on (which returns to its first view). */
  navNonce: number;
  /** Changes when a screen shows a different view of itself (for example place, start, result): the page scrolls back to its top. */
  scrollNonce: number;
  scrollTop(): void;
  /** Where Back goes: unwinds a sub-view first, then Home, then (false) lets the system leave the app. */
  back(): boolean;
  registerBack(fn: (() => boolean) | null): void;
  profile: RequirementsProfile | null;
  saveProfile(p: RequirementsProfile): Promise<void>;
  eraseProfile(): Promise<void>;
  loaded: boolean;
  loadError: string | null;
  repo: ProfileRepo;
  textSize: TextSize;
  setTextSize(t: TextSize): void;
  themePref: ThemePref;
  setThemePref(t: ThemePref): void;
}

const C = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("outside provider");
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repo = useMemo(() => new ProfileRepo(expoKeyStore), []);
  const [screen, setScreen] = useState<Screen>("home");
  const [nonce, setNonce] = useState(0);
  const [scrollNonce, setScrollNonce] = useState(0);
  const [profile, setProfile] = useState<RequirementsProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [textSize, setTextSizeState] = useState<TextSize>("normal");
  const [themePref, setThemePrefState] = useState<ThemePref>("system");
  const subBack = useRef<(() => boolean) | null>(null);
  const screenRef = useRef<Screen>("home");

  useEffect(() => {
    (async () => {
      try {
        const ts = await storage.get(TEXT_KEY);
        if (ts === "normal" || ts === "large" || ts === "xl") setTextSizeState(ts);
        const th = await storage.get(THEME_KEY);
        if (th === "system" || th === "light" || th === "dark") setThemePrefState(th);
      } catch { /* conveniences only; defaults apply */ }
      try {
        setProfile(await repo.load());
      } catch {
        setLoadError("Your saved answers could not be opened on this phone. They cannot be recovered, so please answer the questions again.");
      }
      setLoaded(true);
    })();
  }, [repo]);

  const go = useCallback((s: Screen) => {
    subBack.current = null;
    screenRef.current = s;
    setScreen(s);
    setNonce((n) => n + 1);
  }, []);

  const value: Ctx = {
    screen, go, navNonce: nonce, scrollNonce, scrollTop: () => setScrollNonce((n) => n + 1),
    back: () => {
      if (subBack.current && subBack.current()) return true;
      if (screenRef.current !== "home") { go("home"); return true; }
      return false;
    },
    registerBack: (fn) => { subBack.current = fn; },
    profile,
    saveProfile: async (p) => { await repo.save(p); setProfile(p); setLoadError(null); },
    eraseProfile: async () => { await repo.erase(); setProfile(null); setLoadError(null); },
    loaded, loadError, repo,
    textSize, setTextSize: (t) => { setTextSizeState(t); storage.set(TEXT_KEY, t).catch(() => undefined); },
    themePref, setThemePref: (t) => { setThemePrefState(t); storage.set(THEME_KEY, t).catch(() => undefined); }
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
