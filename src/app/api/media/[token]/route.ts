import { NextResponse } from "next/server";
import { lookupMedia } from "@/lib/media";
import { renderFlag } from "@/lib/render";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return new NextResponse("not found", { status: 404 });
  const spec = lookupMedia(token);
  if (!spec) return new NextResponse("expired", { status: 404 });
  const png = await renderFlag(spec.iso2, spec.opts);
  if (!png) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" } });
}
