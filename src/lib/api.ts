import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { identify, isStaff, type Identity } from "./auth";
import { rateLimit } from "./rate-limit";

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function applyCookies(res: NextResponse, id: Identity | null) {
  if (!id) return res;
  for (const c of id.setCookies)
    res.cookies.set(c.name, c.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1", path: "/", maxAge: c.maxAge });
  return res;
}

function cookieMap(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of req.cookies.getAll()) out[c.name] = c.value;
  return out;
}

type Handler<B> = (args: { req: NextRequest; id: Identity; body: B }) => Promise<NextResponse | object>;

/**
 * Wraps a route: rate limit → identify (guest cookie created on demand) → zod-validate body →
 * optional staff check. Unexpected errors return a generic message (no stack traces leak).
 */
export function route<B = undefined>(opts: { schema?: ZodType<B, z.ZodTypeDef, unknown>; limit?: [number, number]; staff?: boolean; admin?: boolean; name: string }, handler: Handler<B>) {
  return async (req: NextRequest) => {
    const ip = clientIp(req);
    const [cap, refill] = opts.limit ?? [60, 2];
    if (!rateLimit(`${opts.name}:${ip}`, cap, refill)) return json({ error: "Too many requests — slow down a little." }, 429);
    let id: Identity | null = null;
    try {
      id = await identify(cookieMap(req), true);
      if (!id) return json({ error: "unauthorised" }, 401);
      // Staff-only endpoints answer 404 to everyone else so their existence is not advertised.
      if ((opts.staff || opts.admin) && !isStaff(id.user)) return applyCookies(json({ error: "Not found" }, 404), id);
      if (opts.admin && id.user?.role !== "ADMIN") return json({ error: "Admins only." }, 403);
      let body = undefined as B;
      if (opts.schema) {
        const raw = req.method === "GET" ? Object.fromEntries(req.nextUrl.searchParams) : await req.json().catch(() => null);
        const parsed = opts.schema.safeParse(raw);
        if (!parsed.success) return applyCookies(json({ error: "Invalid input", issues: parsed.error.issues.map((i) => i.message).slice(0, 5) }, 400), id);
        body = parsed.data;
      }
      const out = await handler({ req, id, body });
      const res = out instanceof NextResponse ? out : json(out);
      return applyCookies(res, id);
    } catch (e) {
      const msg = e instanceof Error && e.message.length < 140 && !/prisma|sql|ECONN/i.test(e.message) ? e.message : "Something went wrong.";
      if (process.env.NODE_ENV !== "test") console.error(`[api:${opts.name}]`, e);
      return applyCookies(json({ error: msg }, 400), id);
    }
  };
}

export { z };
