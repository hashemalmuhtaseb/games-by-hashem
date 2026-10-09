import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Player, Role, User } from "@prisma/client";
import { db } from "./db";

/**
 * Identity.
 * - Guests: a Player row + an HMAC-signed `pv_guest` cookie (id.signature). Can't be forged.
 * - Accounts: username + bcrypt password; `pv_session` cookie holds a random token, stored only as a
 *   SHA-256 hash, httpOnly + SameSite=Lax (+ Secure in production), 30-day expiry, revocable.
 * - When a guest registers, their guest Player is upgraded so history and stats carry over.
 */

export const GUEST_COOKIE = "pv_guest";
export const SESSION_COOKIE = "pv_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ random chars)");
    return "dev-only-insecure-secret-change-me";
  }
  return s;
}

export function sign(value: string): string {
  const mac = createHmac("sha256", secret()).update(value).digest("base64url").slice(0, 32);
  return `${value}.${mac}`;
}

export function unsign(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value));
  const got = Buffer.from(signed);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  return value;
}

export function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

export function parseCookies(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

const ADJ = ["Swift", "Clever", "Lucky", "Brave", "Sneaky", "Cosmic", "Turbo", "Mighty", "Witty", "Neon", "Silent", "Jolly", "Pixel", "Golden", "Rapid", "Sly", "Bold", "Zesty", "Fuzzy", "Electric"];
const NOUN = ["Otter", "Falcon", "Panda", "Fox", "Tiger", "Koala", "Llama", "Shark", "Owl", "Gecko", "Badger", "Phoenix", "Yak", "Dolphin", "Lynx", "Raven", "Camel", "Wolf", "Moose", "Axolotl"];
export const AVATARS = ["🦊", "🐼", "🦁", "🐯", "🐸", "🐙", "🦄", "🐲", "🦉", "🐧", "🦖", "🐨", "🐵", "🦈", "🐝", "🦩", "🐺", "🦝", "🐬", "🦜", "👾", "🤖", "👽", "🎃"];
export const COLORS = ["#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#eab308", "#ef4444", "#3b82f6", "#14b8a6", "#a855f7"];

function randomOf<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export async function createGuestPlayer(): Promise<Player> {
  return db.player.create({
    data: { displayName: `${randomOf(ADJ)} ${randomOf(NOUN)}`, avatar: randomOf(AVATARS), color: randomOf(COLORS), isGuest: true, profile: { create: {} } },
  });
}

export interface Identity {
  player: Player;
  user: (User & { role: Role }) | null;
  /** cookies that should be set on the response */
  setCookies: { name: string; value: string; maxAge: number }[];
}

function touch(p: Player) {
  if (Date.now() - p.lastSeenAt.getTime() > 120_000) db.player.update({ where: { id: p.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
}

/** Resolve the caller from cookies. Creates a guest player when `create` is true and none exists. */
export async function identify(cookies: Record<string, string>, create = true): Promise<Identity | null> {
  const setCookies: Identity["setCookies"] = [];
  const token = cookies[SESSION_COOKIE];
  if (token) {
    const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { player: true } } } });
    if (session && session.expiresAt > new Date() && !session.user.bannedAt && session.user.player) {
      touch(session.user.player);
      return { player: session.user.player, user: session.user, setCookies };
    }
  }
  const guestId = unsign(cookies[GUEST_COOKIE]);
  if (guestId) {
    const p = await db.player.findUnique({ where: { id: guestId } });
    if (p && !p.userId) {
      touch(p);
      return { player: p, user: null, setCookies };
    }
  }
  if (!create) return null;
  const p = await createGuestPlayer();
  setCookies.push({ name: GUEST_COOKIE, value: sign(p.id), maxAge: 365 * 86400 });
  return { player: p, user: null, setCookies };
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function register(username: string, password: string, guestPlayerId: string | null) {
  const exists = await db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  if (exists) return { error: "That username is taken." } as const;
  const passwordHash = await bcrypt.hash(password, 11);
  const role: Role = process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME.toLowerCase() === username.toLowerCase() ? "ADMIN" : "USER";
  const user = await db.user.create({ data: { username, passwordHash, role } });
  // Upgrade the guest player (keeps history/stats) or create a fresh one.
  const guest = guestPlayerId ? await db.player.findUnique({ where: { id: guestPlayerId } }) : null;
  if (guest && !guest.userId) {
    await db.player.update({ where: { id: guest.id }, data: { userId: user.id, isGuest: false, displayName: username } });
  } else {
    await db.player.create({ data: { userId: user.id, isGuest: false, displayName: username, avatar: randomOf(AVATARS), color: randomOf(COLORS), profile: { create: {} } } });
  }
  return { user } as const;
}

export async function login(username: string, password: string) {
  const user = await db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  // Always run bcrypt to keep timing uniform whether or not the user exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) return { error: "Wrong username or password." } as const;
  if (user.bannedAt) return { error: "This account is suspended." } as const;
  return { user } as const;
}

export async function createSession(userId: string, userAgent?: string): Promise<{ token: string; maxAge: number }> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { userId, tokenHash: hashToken(token), userAgent: userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function isStaff(user: { role: Role } | null): boolean {
  return !!user && (user.role === "ADMIN" || user.role === "MODERATOR");
}
