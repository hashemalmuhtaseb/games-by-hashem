/**
 * Verified answers added after review. When players report a rejected answer
 * ("I think this answer is valid"), an admin checks it against a reliable source and, if it is
 * genuinely valid, adds it here. Format per line: "Canonical name|alias|alias".
 * Tier 3 = known but uncommon, tier 4 = obscure (affects the starting rarity estimate only;
 * real answer frequencies take over as players use it).
 */
export const ANSWER_ADDITIONS: Record<string, { tier: 3 | 4; entries: string[] }[]> = {
  // footballers: [{ tier: 4, entries: ["Example Player|E. Player"] }],
};
