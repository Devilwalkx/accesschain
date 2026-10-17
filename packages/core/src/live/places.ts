/**
 * Places and start points offered in the live version. Only NAMES are listed here; everything about a place
 * (position, accessibility notes) is looked up from OpenStreetMap at the moment you ask, never bundled.
 * Station ids are TfL NaPTAN ids verified to work with the TfL journey planner on 2026-10-17.
 */
export interface Venue {
  id: string;
  name: string;
  /** Text sent to the geocoder. */
  query: string;
}

export const VENUES: Venue[] = [
  { id: "tate-modern", name: "Tate Modern", query: "Tate Modern" },
  { id: "shakespeares-globe", name: "Shakespeare's Globe", query: "Shakespeare's Globe" },
  { id: "national-theatre", name: "National Theatre", query: "National Theatre" },
  { id: "royal-festival-hall", name: "Royal Festival Hall", query: "Royal Festival Hall" },
  { id: "bfi-southbank", name: "BFI Southbank", query: "BFI Southbank" },
  { id: "hayward-gallery", name: "Hayward Gallery", query: "Hayward Gallery" },
  { id: "borough-market", name: "Borough Market", query: "Borough Market" },
  { id: "southwark-cathedral", name: "Southwark Cathedral", query: "Southwark Cathedral" },
  { id: "old-vic", name: "The Old Vic", query: "The Old Vic" },
  { id: "imperial-war-museum", name: "Imperial War Museum", query: "Imperial War Museum London" }
];

export interface Station {
  id: string;
  name: string;
}

export const STATIONS: Station[] = [
  { id: "940GZZLUWLO", name: "Waterloo" },
  { id: "940GZZLULNB", name: "London Bridge" },
  { id: "940GZZLUSWK", name: "Southwark" },
  { id: "940GZZLUBKF", name: "Blackfriars" },
  { id: "940GZZLUBOR", name: "Borough" }
];

export const ATTRIBUTION = [
  "Transport information: Powered by TfL Open Data.",
  "Contains OS data © Crown copyright and database rights 2016 and Geomni UK Map data © and database rights 2019.",
  "Place information: © OpenStreetMap contributors, available under the Open Database Licence (openstreetmap.org/copyright).",
  "AccessChain is not run, checked or endorsed by TfL or OpenStreetMap."
];
