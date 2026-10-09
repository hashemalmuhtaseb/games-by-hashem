import { NextResponse } from "next/server";
import { route, z, json } from "@/lib/api";
import { createSession, login, SESSION_COOKIE } from "@/lib/auth";

const Body = z.object({ username: z.string().min(1).max(40), password: z.string().min(1).max(200) });

export const POST = route({ name: "auth.login", schema: Body, limit: [8, 0.1] }, async ({ body, req }) => {
  const r = await login(body.username, body.password);
  if ("error" in r) return json({ error: r.error }, 401);
  const s = await createSession(r.user.id, req.headers.get("user-agent") ?? undefined);
  const res = NextResponse.json({ ok: true, username: r.user.username, role: r.user.role });
  res.cookies.set(SESSION_COOKIE, s.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1", path: "/", maxAge: s.maxAge });
  return res;
});
