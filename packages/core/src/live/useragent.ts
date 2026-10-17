/**
 * The User-Agent the native app sends to OpenStreetMap and TfL. One builder, used by the app and by the CI recording step,
 * so what CI records is what the app sends. (Browsers cannot set this header; the web build sends the browser's own.)
 * OSMF policy: identify the application; a library default is not acceptable.
 */
export const APP_ID = "app.devilwalkx.accesschain";
export function buildUserAgent(version: string): string {
  return `AccessChain/${version} (${APP_ID}; +https://github.com/Devilwalkx/accesschain)`;
}
