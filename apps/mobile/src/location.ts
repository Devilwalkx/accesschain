import * as Location from "expo-location";
import { minimiseCoordinate, type LatLng } from "@accesschain/core";

export type LocationResult =
  | { kind: "ok"; point: LatLng }
  /** `canAskAgain` false means "don't ask again" was chosen: only the phone's settings can change it. */
  | { kind: "denied"; canAskAgain: boolean }
  | { kind: "unavailable" };

/**
 * One-shot, foreground-only, coarse location, only when the person taps the button (the screen explains first).
 * No watchers, no background tracking, no storage. The result is rounded to about 100 m before it is used.
 */
export async function getCoarseOriginOnce(): Promise<LocationResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { kind: "denied", canAskAgain: perm.canAskAgain !== false };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { kind: "ok", point: minimiseCoordinate({ lat: pos.coords.latitude, lng: pos.coords.longitude }) };
  } catch {
    return { kind: "unavailable" };
  }
}
