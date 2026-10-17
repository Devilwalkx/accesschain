import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
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
    // Browsers cannot set User-Agent, and api.openstreetmap.org blocks browsers (no CORS), so the web build skips edit dates.
    userAgent: Platform.OS === "web" ? undefined : "AccessChain/0.1 (prototype; github.com/Devilwalkx/accesschain)",
    allowOsmApi: Platform.OS !== "web"
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
