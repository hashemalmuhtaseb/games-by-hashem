/** Minimal word filter shared by chat and the content pipeline. */
const BLOCKED = ["fuck", "shit", "cunt", "nigg", "fag", "retard", "whore", "slut", "bitch"];

export function maskBlocked(s: string): string {
  for (const w of BLOCKED) s = s.replace(new RegExp(w + "\\w*", "gi"), (m) => m[0] + "*".repeat(m.length - 1));
  return s;
}

export function containsBlocked(s: string): boolean {
  const low = s.toLowerCase();
  return BLOCKED.some((w) => low.includes(w));
}
