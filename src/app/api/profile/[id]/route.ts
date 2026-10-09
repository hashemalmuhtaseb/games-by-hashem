import type { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { publicProfile } from "@/server/profiles";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return route({ name: "profile", limit: [60, 3] }, async () => {
    if (!/^[a-z0-9]{10,40}$/i.test(id)) return json({ error: "Not found" }, 404);
    const p = await publicProfile(id);
    if (!p) return json({ error: "Not found" }, 404);
    return { profile: p };
  })(req);
}
