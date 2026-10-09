/** Dev helper: prints sample rounds for a game so content can be eyeballed. Usage: tsx scripts/sample-rounds.ts <slug> [n] */
import { getGame } from "@/engine/registry";
import { createRng } from "@/engine/rng";
import { gameCandidates } from "@/engine/selection";

const [slug, nStr] = process.argv.slice(2);
const g = getGame(slug);
if (!g) throw new Error("unknown game");
const rng = createRng(String(Date.now()));
const media = { flag: (iso: string) => `[flag ${iso}]` };
const cands = gameCandidates(g);
for (let i = 0; i < Number(nStr ?? 4); i++) {
  const c = cands[Math.floor(rng() * cands.length)];
  const mode = g.modes.find((m) => m.id === c.mode)!;
  try {
    const r = await mode.build(c, { rng, media });
    const opts = r.pub.options?.map((o) => (o.id === r.secret.correctOptionId ? `*${o.label}*` : o.label)).join(" | ");
    console.log(`— [${c.mode}] ${r.pub.prompt}`);
    if (r.pub.media) console.log("   media:", JSON.stringify(r.pub.media).slice(0, 200));
    if (r.pub.extra && Object.keys(r.pub.extra).length) console.log("   extra:", JSON.stringify(r.pub.extra).slice(0, 200));
    if (opts) console.log("   options:", opts);
    if (r.secret.clues) console.log("   clues:", r.secret.clues.join(" / ").slice(0, 300));
    if (r.secret.data?.question) console.log("   q:", r.secret.data.question, JSON.stringify(r.secret.data.options).slice(0, 200));
    console.log("   answer:", r.secret.answerLabel, "|", (r.secret.explanation ?? "").slice(0, 200));
  } catch (e) {
    console.log(`— [${c.mode}] build failed: ${(e as Error).message}`);
  }
}
