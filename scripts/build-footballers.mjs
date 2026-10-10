#!/usr/bin/env node
/**
 * Builds src/content/datasets/generated/footballers.tsv.gz from Wikidata (CC0).
 *
 *   node scripts/build-footballers.mjs
 *
 * Who is included: every person whose occupation (P106) is "association football player"
 * (Q937857) and who has articles on at least MIN_SITELINKS Wikimedia sites. That bar keeps the list
 * to notable players (professionals, internationals, historic players) and excludes stubs.
 *
 * Columns: qid, display name (English label, else the multilingual "mul" label), aliases
 * (|-separated), sitelinks, birth year, death year. Sitelinks are a fame signal for the rarity prior.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_SITELINKS = 4;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/content/datasets/generated/footballers.tsv.gz");
const UA = "PartyVerseDatasetBuilder/1.0 (https://github.com/hashemalmuhtaseb/games-by-hashem)";

async function sparql(query, attempt = 1) {
  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query);
  const res = await fetch(url, { headers: { Accept: "text/tab-separated-values", "User-Agent": UA } });
  const text = await res.text();
  if (!res.ok || !text.startsWith("?")) {
    if (attempt >= 6) throw new Error(`Wikidata query failed (${res.status}): ${text.slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
    return sparql(query, attempt + 1);
  }
  return text
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split("\t"));
}

const lit = (v) => (v ? v.replace(/^"(.*)"(@[a-z-]+|\^\^.*)?$/s, "$1").replace(/\\"/g, '"').replace(/\\\\/g, "\\") : "");
const qid = (v) => v.replace(/^<http:\/\/www\.wikidata\.org\/entity\/(Q\d+)>$/, "$1");

// Sitelink bands small enough for each query to finish inside the 60s WDQS limit.
const BANDS = [[60, 100000], [40, 59], [30, 39], [24, 29], [19, 23], [15, 18], [12, 14], [10, 11], [9, 9], [8, 8], [7, 7], [6, 6], [5, 5], [4, 4]].filter(([lo]) => lo >= MIN_SITELINKS);

const players = new Map();

for (const [lo, hi] of BANDS) {
  const rows = await sparql(`SELECT ?p ?label ?l ?born ?died WHERE {
    ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?l .
    FILTER(?l >= ${lo} && ?l <= ${hi})
    ?p rdfs:label ?label . FILTER(LANG(?label) = "en" || LANG(?label) = "mul")
    OPTIONAL { ?p wdt:P569 ?b . BIND(YEAR(?b) AS ?born) }
    OPTIONAL { ?p wdt:P570 ?d . BIND(YEAR(?d) AS ?died) }
  }`);
  for (const [p, label, l, born, died] of rows) {
    const id = qid(p);
    const prev = players.get(id);
    const name = lit(label);
    if (!name || /^Q\d+$/.test(name)) continue;
    // Many items now carry only a language-neutral "mul" label; an English label wins when both exist.
    const isEn = /@en$/.test(label);
    const keepName = prev && (prev.en || !isEn) ? prev.name : name;
    const aliases = prev?.aliases ?? [];
    if (prev && keepName !== name && !aliases.includes(name)) aliases.push(name);
    if (prev && keepName === name && prev.name !== name && !aliases.includes(prev.name)) aliases.push(prev.name);
    players.set(id, { id, name: keepName, en: !!(prev?.en || isEn), aliases, links: Number(l), born: born ? Number(born) : prev?.born ?? null, died: died ? Number(died) : prev?.died ?? null });
  }
  console.log(`sitelinks ${lo}-${hi}: ${rows.length} rows, ${players.size} players`);
  await new Promise((r) => setTimeout(r, 1500));
}

for (const [lo, hi] of BANDS) {
  const rows = await sparql(`SELECT ?p ?alias WHERE {
    ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?l .
    FILTER(?l >= ${lo} && ?l <= ${hi})
    ?p skos:altLabel ?alias . FILTER(LANG(?alias) = "en" || LANG(?alias) = "mul")
  }`);
  for (const [p, alias] of rows) {
    const pl = players.get(qid(p));
    const a = lit(alias);
    // Skip junk aliases: very long strings, ones with digits or brackets.
    if (pl && a && a.length <= 40 && !/[\d()[\]:;/@]/.test(a) && !/(.)\1\1\1/.test(a) && a !== pl.name && !pl.aliases.includes(a)) pl.aliases.push(a);
  }
  console.log(`aliases ${lo}-${hi}: ${rows.length}`);
  await new Promise((r) => setTimeout(r, 1500));
}

const clean = (s) => s.replace(/[\t\n\r|]/g, " ").trim();
const lines = [...players.values()]
  .sort((a, b) => b.links - a.links || a.name.localeCompare(b.name))
  .map((p) => [p.id, clean(p.name), p.aliases.map(clean).slice(0, 8).join("|"), p.links, p.born ?? "", p.died ?? ""].join("\t"));
mkdirSync(dirname(OUT), { recursive: true });
const header = `# Association football players from Wikidata (CC0), occupation Q937857, sitelinks >= ${MIN_SITELINKS}. Built ${new Date().toISOString().slice(0, 10)}.\n# qid\tname\taliases\tsitelinks\tborn\tdied\n`;
writeFileSync(OUT, gzipSync(header + lines.join("\n") + "\n", { level: 9 }));
console.log(`wrote ${lines.length} players to ${OUT}`);
