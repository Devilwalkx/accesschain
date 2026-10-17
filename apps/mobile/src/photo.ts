import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { hasJpegMetadata, stripJpegMetadata } from "@accesschain/core";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Report photos: re-encode on device (drops EXIF/GPS), then verify with the core metadata check
 * and strip again as a second control. If metadata remains or the file is malformed we throw
 * and nothing is uploaded. Faces/bystanders still need user review before submission.
 * Re-encoding behaviour must be confirmed on real iOS and Android builds (SECURITY_TESTS.md T-13).
 */
export async function pickAndSanitisePhoto(): Promise<{ uri: string; bytes: Uint8Array } | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], exif: false, quality: 0.8, allowsMultipleSelection: false });
  if (picked.canceled || !picked.assets[0]) return null;
  const re = await ImageManipulator.manipulateAsync(picked.assets[0].uri, [{ resize: { width: 1600 } }], {
    compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true
  });
  if (!re.base64) throw new Error("Image re-encode produced no data");
  let bytes = b64ToBytes(re.base64);
  if (hasJpegMetadata(bytes)) bytes = stripJpegMetadata(bytes);
  if (hasJpegMetadata(bytes)) throw new Error("Could not remove photo metadata; photo rejected");
  return { uri: re.uri, bytes };
}
