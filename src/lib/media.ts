import { randomBytes } from "node:crypto";
import type { FlagRender, MediaRegistry } from "@/engine/types";
import { singleton } from "./globals";

/**
 * Opaque media tokens. Round payloads reference images as /api/media/<random token>, so the
 * URL never reveals the answer (no /flags/FR.png). Tokens expire after a few hours.
 */
interface MediaSpec {
  kind: "flag";
  iso2: string;
  opts: FlagRender;
  exp: number;
}

const TTL = 6 * 3600_000;
const store = singleton("media", () => new Map<string, MediaSpec>());

function sweep() {
  if (store.size < 20_000) return;
  const now = Date.now();
  for (const [k, v] of store) if (v.exp < now) store.delete(k);
}

export function registerFlag(iso2: string, opts: FlagRender = {}): string {
  sweep();
  const token = randomBytes(12).toString("base64url");
  store.set(token, { kind: "flag", iso2, opts, exp: Date.now() + TTL });
  return `/api/media/${token}`;
}

export function lookupMedia(token: string): MediaSpec | undefined {
  const s = store.get(token);
  if (!s || s.exp < Date.now()) return undefined;
  return s;
}

export const mediaRegistry: MediaRegistry = { flag: registerFlag };
