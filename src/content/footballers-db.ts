import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * The verified football player list: ~150,000 professional, international and historic players
 * from Wikidata (CC0), built by scripts/build-footballers.mjs. Server-side only; loaded lazily on
 * first use (≈0.5 s, ≈40 MB of memory).
 */

export interface DbFootballer {
  qid: string;
  name: string;
  aliases: string[];
  /** Wikipedia/Wikimedia sitelinks: our fame signal. */
  fame: number;
  born: number | null;
  died: number | null;
}

let cache: DbFootballer[] | null = null;

export const FOOTBALLERS_DB_SOURCE = "Football players: Wikidata (CC0), every person with occupation “association football player” and articles on 4+ Wikimedia sites.";

export function footballersDb(): DbFootballer[] {
  if (cache) return cache;
  const file = join(process.cwd(), "src", "content", "datasets", "generated", "footballers.tsv.gz");
  let text: string;
  try {
    text = gunzipSync(readFileSync(file)).toString("utf8");
  } catch (e) {
    console.error(`[footballers-db] could not read ${file}`, e);
    cache = [];
    return cache;
  }
  const out: DbFootballer[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [qid, name, aliases, fame, born, died] = line.split("\t");
    if (!name) continue;
    out.push({ qid, name, aliases: aliases ? aliases.split("|").filter(Boolean) : [], fame: Number(fame) || 0, born: born ? Number(born) : null, died: died ? Number(died) : null });
  }
  cache = out;
  return out;
}
