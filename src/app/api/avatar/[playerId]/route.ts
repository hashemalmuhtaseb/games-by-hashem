import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Serves a player's profile picture. URLs carry the picture's version (?v=3), so a matching
 * request can be cached forever; a new upload bumps the version and changes the URL everywhere,
 * which is what busts browser and CDN caches. A stale or missing version is never cached.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(playerId)) return new NextResponse("not found", { status: 404 });
  const row = await db.avatarImage.findUnique({ where: { playerId }, select: { data: true, mime: true, version: true } });
  if (!row) return new NextResponse("not found", { status: 404, headers: { "cache-control": "no-store" } });
  const v = Number(req.nextUrl.searchParams.get("v"));
  const etag = `"${playerId}-${row.version}"`;
  const fresh = v === row.version;
  const headers = {
    "content-type": row.mime,
    etag,
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
    "cache-control": fresh ? "public, max-age=31536000, immutable" : "no-cache",
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(new Uint8Array(row.data), { headers });
}
