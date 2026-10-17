import { useEffect, useState } from "react";
import { useApp } from "./store";

/**
 * Local sub-screen state that the system Back button/gesture unwinds one step at a time,
 * before it leaves the screen. `root` is the state Back returns to.
 */
export function useView<V extends { k: string }>(root: V, initial?: V): [V, (v: V) => void] {
  const app = useApp();
  const [view, setView] = useState<V>(initial ?? root);
  useEffect(() => {
    app.registerBack(() => {
      if (view.k !== root.k) { setView(root); return true; }
      return false;
    });
    return () => app.registerBack(null);
  });
  return [view, setView];
}
