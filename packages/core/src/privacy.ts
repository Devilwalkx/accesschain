/** Privacy helpers: coordinate minimisation, log redaction and photo metadata stripping. */

export interface LatLng {
  lat: number;
  lng: number;
}

export function isValidCoordinate(c: LatLng): boolean {
  return Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180;
}

/**
 * Round to a coarser grid before sending to a third-party route service.
 * 3 decimal places is roughly 100 m of latitude. The provider still learns an approximate
 * origin/destination: this reduces precision, it does not make the lookup anonymous.
 */
export function minimiseCoordinate(c: LatLng, decimals = 3): LatLng {
  if (!isValidCoordinate(c)) throw new Error("Invalid coordinate");
  const f = 10 ** decimals;
  return { lat: Math.round(c.lat * f) / f, lng: Math.round(c.lng * f) / f };
}

const COORD_PAIR = /-?\d{1,3}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/g;
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const SENSITIVE_KEYS = /(lat|lng|lon|latitude|longitude|origin|destination|postcode|profile|requirement|address)/i;

/** Redact coordinates and postcodes from free text destined for logs. */
export function redactText(s: string): string {
  return s.replace(COORD_PAIR, "[coords]").replace(POSTCODE, "[postcode]");
}

/** Deep-redact an object before logging. Sensitive keys are replaced wholesale; strings are scrubbed. */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((v) => redactForLog(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : redactForLog(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Strip metadata from a JPEG: removes APP1 (EXIF/XMP, incl. GPS), APP13 (IPTC) and COM segments,
 * keeps everything else byte-for-byte. Throws on malformed input rather than passing it through.
 * Re-encoding on-device (expo-image-manipulator) is the primary control; this is a verifiable second check.
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new Error("Not a JPEG");
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) throw new Error("Malformed JPEG: expected marker");
    let marker = input[i + 1];
    if (marker === undefined) throw new Error("Malformed JPEG: truncated marker");
    // fill bytes
    while (marker === 0xff) {
      i++;
      marker = input[i + 1];
      if (marker === undefined) throw new Error("Malformed JPEG: truncated marker");
    }
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      return Uint8Array.from(out);
    }
    if (marker === 0xda) {
      // Start of scan: copy the rest verbatim (entropy-coded data).
      for (let j = i; j < input.length; j++) out.push(input[j]!);
      return Uint8Array.from(out);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const hi = input[i + 2];
    const lo = input[i + 3];
    if (hi === undefined || lo === undefined) throw new Error("Malformed JPEG: truncated segment length");
    const len = (hi << 8) | lo;
    if (len < 2 || i + 2 + len > input.length) throw new Error("Malformed JPEG: bad segment length");
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) for (let j = i; j < i + 2 + len; j++) out.push(input[j]!);
    i += 2 + len;
  }
  throw new Error("Malformed JPEG: no end of image or scan");
}

/** True if any APP1/APP13/COM segment is present before the scan data. */
export function hasJpegMetadata(input: Uint8Array): boolean {
  let i = 2;
  while (i + 3 < input.length && input[i] === 0xff) {
    const m = input[i + 1]!;
    if (m === 0xda || m === 0xd9) return false;
    if (m === 0xe1 || m === 0xed || m === 0xfe) return true;
    const len = (input[i + 2]! << 8) | input[i + 3]!;
    if (len < 2) return false;
    i += 2 + len;
  }
  return false;
}
