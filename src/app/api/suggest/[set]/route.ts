import { NextResponse } from "next/server";
import { SUGGEST_SETS, suggestNames } from "@/content/suggest";
import type { SuggestSet } from "@/engine/types";

export async function GET(_req: Request, { params }: { params: Promise<{ set: string }> }) {
  const { set } = await params;
  if (!(set in SUGGEST_SETS)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ names: suggestNames(set as SuggestSet) }, { headers: { "cache-control": "public, max-age=3600" } });
}
