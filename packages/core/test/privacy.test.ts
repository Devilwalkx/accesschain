import { describe, expect, it } from "vitest";
import { hasJpegMetadata, minimiseCoordinate, redactForLog, redactText, stripJpegMetadata } from "../src/index.js";

const enc = (s: string) => Array.from(new TextEncoder().encode(s));
function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 255, ...payload];
}
function jpeg(withExif: boolean): Uint8Array {
  const exif = segment(0xe1, [...enc("Exif\0\0"), ...enc("GPSLatitude=51.5007;GPSLongitude=-0.1246")]);
  const xmp = segment(0xe1, enc("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>home</x:xmpmeta>"));
  const iptc = segment(0xed, enc("Photoshop 3.0\0name"));
  const com = segment(0xfe, enc("shot at home"));
  const jfif = segment(0xe0, [...enc("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const dqt = segment(0xdb, new Array(65).fill(1));
  const sos = [0xff, 0xda, 0, 3, 1, 0, 1, 2, 3, 0xff, 0x00, 4, 5, 0xff, 0xd9];
  return Uint8Array.from([0xff, 0xd8, ...jfif, ...(withExif ? [...exif, ...xmp, ...iptc, ...com] : []), ...dqt, ...sos]);
}
const text = (u: Uint8Array) => new TextDecoder("latin1").decode(u);

describe("photo metadata", () => {
  it("strips EXIF/GPS, XMP, IPTC and comments but keeps image segments and scan data", () => {
    const input = jpeg(true);
    expect(hasJpegMetadata(input)).toBe(true);
    const out = stripJpegMetadata(input);
    const t = text(out);
    for (const s of ["GPSLatitude", "GPSLongitude", "xmpmeta", "Photoshop", "shot at home", "Exif"]) expect(t).not.toContain(s);
    expect(hasJpegMetadata(out)).toBe(false);
    expect(t).toContain("JFIF");
    expect(out).toEqual(stripJpegMetadata(jpeg(false)));
    expect(out.at(-2)).toBe(0xff);
    expect(out.at(-1)).toBe(0xd9);
  });
  it("rejects non-JPEG, truncated and corrupt segment lengths instead of passing them through", () => {
    expect(() => stripJpegMetadata(Uint8Array.from([1, 2, 3, 4]))).toThrow();
    expect(() => stripJpegMetadata(jpeg(true).slice(0, 30))).toThrow();
    expect(() => stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0, 0]))).toThrow();
    expect(() => stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0x00, 0x00]))).toThrow();
  });
});

describe("location and logging", () => {
  it("coordinates are reduced before leaving the device; invalid ones throw", () => {
    expect(minimiseCoordinate({ lat: 51.500729, lng: -0.124625 })).toEqual({ lat: 51.501, lng: -0.125 });
    expect(() => minimiseCoordinate({ lat: 91, lng: 0 })).toThrow();
    expect(() => minimiseCoordinate({ lat: NaN, lng: 0 })).toThrow();
  });
  it("logs never carry coordinates, postcodes or profile data", () => {
    expect(redactText("origin 51.500729, -0.124625 near SW1A 2AA")).not.toMatch(/51\.50|SW1A/);
    const out = JSON.stringify(redactForLog({ msg: "route at 51.500729,-0.124625", requirementsProfile: { avoidSteps: true }, origin: { lat: 1, lng: 2 }, ok: 3 }));
    expect(out).not.toMatch(/51\.50|avoidSteps|"lat"/);
    expect(out).toContain('"ok":3');
  });
});
