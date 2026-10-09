import worldCountries from "world-countries";

/**
 * Countries & territories.
 * Source: mledoze/countries via the `world-countries` npm package (ODbL-1.0).
 * Flags: `country-flag-icons` (MIT), rendered server-side so image URLs never reveal the answer.
 */

export interface Country {
  iso2: string;
  iso3: string;
  name: string;
  official: string;
  aliases: string[];
  capital: string[];
  region: string;
  subregion: string;
  lat: number;
  lng: number;
  areaKm2: number;
  borders: string[]; // iso3
  landlocked: boolean;
  unMember: boolean;
  independent: boolean;
  languages: string[];
  currencies: string[];
  flagEmoji: string;
  /** 1 = everyone knows it … 4 = obscure. Baseline for difficulty and Rare Words priors. */
  fame: number;
}

const FAME1 = new Set(
  "US GB FR DE IT ES CN JP BR CA AU IN RU MX EG SA AR PT NL GR TR KR ZA NG IE CH SE NO".split(" "),
);
const FAME2 = new Set(
  "BE AT DK FI PL UA IL IR IQ PK AF TH VN ID PH MY SG NZ CL CO PE VE CU JM MA DZ TN KE ET GH SN CM AE QA KW JO LB SY KP CZ HU RO HR RS IS LU MC VA SC MV NP BD LK UY PY BO EC".split(
    " ",
  ),
);

// Extra common-English aliases the dataset doesn't include.
const EXTRA_ALIASES: Record<string, string[]> = {
  US: ["USA", "United States of America", "America", "US", "U.S.", "U.S.A."],
  GB: ["UK", "Britain", "Great Britain", "England"],
  KR: ["South Korea", "Korea"],
  KP: ["North Korea"],
  CZ: ["Czech Republic", "Czechia"],
  CI: ["Ivory Coast", "Cote d'Ivoire"],
  CD: ["DR Congo", "DRC", "Democratic Republic of the Congo", "Congo-Kinshasa"],
  CG: ["Republic of the Congo", "Congo-Brazzaville", "Congo"],
  MM: ["Burma", "Myanmar"],
  TL: ["East Timor", "Timor-Leste"],
  SZ: ["Swaziland", "Eswatini"],
  MK: ["Macedonia", "North Macedonia"],
  TR: ["Turkey", "Türkiye", "Turkiye"],
  NL: ["Holland", "The Netherlands"],
  AE: ["UAE", "Emirates"],
  VA: ["Vatican", "Holy See", "Vatican City"],
  PS: ["Palestine", "State of Palestine"],
  CV: ["Cape Verde", "Cabo Verde"],
  RU: ["Russian Federation"],
  BA: ["Bosnia", "Bosnia-Herzegovina"],
};

export const COUNTRIES: Country[] = worldCountries
  .filter((c) => c.cca2 !== "AQ" && c.area > 0)
  .map((c) => {
    const iso2 = c.cca2;
    const fame = FAME1.has(iso2) ? 1 : FAME2.has(iso2) ? 2 : c.unMember ? 3 : 4;
    const aliases = Array.from(
      new Set(
        [c.name.common, c.name.official, ...(EXTRA_ALIASES[iso2] ?? []), ...c.altSpellings.filter((a) => a.length > 3)].filter(
          Boolean,
        ),
      ),
    );
    return {
      iso2,
      iso3: c.cca3,
      name: c.name.common,
      official: c.name.official,
      aliases,
      capital: c.capital ?? [],
      region: c.region,
      subregion: c.subregion,
      lat: c.latlng[0],
      lng: c.latlng[1],
      areaKm2: c.area,
      borders: c.borders ?? [],
      landlocked: c.landlocked,
      unMember: c.unMember,
      independent: !!c.independent,
      languages: Object.values(c.languages ?? {}),
      currencies: Object.values(c.currencies ?? {}).map((x) => (x as { name: string }).name),
      flagEmoji: c.flag,
      fame,
    };
  });

export const COUNTRY_BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));
export const COUNTRY_BY_ISO3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));

/** Flags that are notoriously easy to confuse (verified by eye against the rendered SVGs). */
export const SIMILAR_FLAG_SETS: string[][] = [
  ["TD", "RO", "AD", "MD"],
  ["ID", "MC", "PL", "SG"],
  ["AU", "NZ", "FJ", "TV"],
  ["IE", "CI", "IT", "MX"],
  ["NL", "LU", "FR", "RU"],
  ["SI", "SK", "RU", "RS"],
  ["NO", "IS", "FO", "DK"],
  ["CO", "EC", "VE", "BO"],
  ["SN", "ML", "GN", "CM"],
  ["HN", "NI", "SV", "GT"],
  ["QA", "BH", "LV", "PL"],
  ["BE", "DE", "AM", "LT"],
  ["SE", "FI", "DK", "NO"],
  ["SY", "IQ", "EG", "YE"],
  ["JO", "PS", "SD", "EH"],
  ["AE", "KW", "JO", "SD"],
  ["NE", "IN", "CI", "IE"],
  ["LR", "US", "MY", "PR"],
  ["CU", "PR", "GR", "UY"],
  ["GH", "BO", "LT", "ET"],
  ["CD", "TZ", "NA", "ZA"],
  ["KG", "VN", "CN", "MA"],
  ["DZ", "PK", "TR", "TN"],
];

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Initial bearing → compass arrow. */
export function direction(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ["⬆️ N", "↗️ NE", "➡️ E", "↘️ SE", "⬇️ S", "↙️ SW", "⬅️ W", "↖️ NW"];
  return dirs[Math.round(brng / 45) % 8];
}

export function countryNames(c: Country): string[] {
  return c.aliases;
}
