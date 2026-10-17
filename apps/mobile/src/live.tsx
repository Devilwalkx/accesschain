import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { LiveClient } from "@accesschain/core";
import { storage } from "./storage";

/**
 * Information source. "unset" until the person chooses; nothing is fetched before they say yes.
 * Only this non-secret choice is stored.
 */
export type Mode = "unset" | "live" | "demo";
const KEY = "ac.mode";

interface Ctx {
  mode: Mode;
  setMode: (m: Mode) => void;
  client: LiveClient;
}

function buildClient() {
  return new LiveClient({
    fetch: (url, init) => fetch(url, init as RequestInit) as unknown as ReturnType<ConstructorParameters<typeof LiveClient>[0]["fetch"]>,
    now: () => new Date(),
    // OSM and TfL ask apps to identify themselves. Browsers cannot set User-Agent (they send their own and a Referer), so only native sets it.
    userAgent: Platform.OS === "web" ? undefined : `AccessChain/${Constants.expoConfig?.version ?? "0.2.0"} (app.devilwalkx.accesschain; +https://github.com/Devilwalkx/accesschain)`,
    // The OSM editing API is not for read-only use (OSMF API usage policy), so edit dates are not fetched on any platform.
    allowOsmApi: false
  });
}

const LiveCtx = createContext<Ctx | null>(null);

export function LiveModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("unset");
  const client = useMemo(buildClient, []);
  useEffect(() => {
    storage.get(KEY).then((v) => {
      if (v === "live" || v === "demo") setModeState(v);
    }).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      mode,
      client,
      setMode: (m) => {
        setModeState(m);
        (m === "unset" ? storage.delete(KEY) : storage.set(KEY, m)).catch(() => {});
      }
    }),
    [mode, client]
  );
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive(): Ctx {
  const c = useContext(LiveCtx);
  if (!c) throw new Error("LiveModeProvider missing");
  return c;
}
