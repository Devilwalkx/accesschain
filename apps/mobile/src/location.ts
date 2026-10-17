import * as Location from "expo-location";
import { minimiseCoordinate, type LatLng } from "@accesschain/core";

/**
 * One-shot, foreground-only, coarse location, only when the user taps the button.
 * No watchers, no background tracking, no storage. The result is minimised before use.
 */
export async function getCoarseOriginOnce(): Promise<LatLng | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  return minimiseCoordinate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
}
