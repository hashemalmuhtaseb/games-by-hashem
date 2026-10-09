import { NextResponse } from "next/server";
import { route, z, json } from "@/lib/api";
import { USERNAME_RE, createSession, register, SESSION_COOKIE } from "@/lib/auth";

const Body = z.object({ username: z.string().regex(USERNAME_RE, "3–20 letters, numbers or _"), password: z.string().min(8, "At least 8 characters").max(200) });

export const POST = route({ name: "auth.register", schema: Body, limit: [5, 0.05] }, async ({ id, body, req }) => {
  const r = await register(body.username, body.password, id.player.userId ? null : id.player.id);
  if ("error" in r) return json({ error: r.error }, 400);
  const s = await createSession(r.user.id, req.headers.get("user-agent") ?? undefined);
  const res = NextResponse.json({ ok: true, username: r.user.username, role: r.user.role });
  res.cookies.set(SESSION_COOKIE, s.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1", path: "/", maxAge: s.maxAge });
  return res;
});
