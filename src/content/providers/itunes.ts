import type { Song } from "@/content/datasets/songs";
import { compact } from "@/engine/normalize";

/**
 * Optional audio-preview provider for Guess the Song.
 *
 * Uses Apple's public iTunes Search API, whose 30-second previews Apple permits for promoting the
 * music (attribution required). Nothing is bundled or re-hosted: the browser streams the preview
 * from Apple's CDN. OFF by default — set ENABLE_ITUNES_PREVIEWS=1 after reviewing Apple's terms
 * for your deployment. Without it, the "Listen & guess" mode is hidden, never faked.
 */

interface Preview {
  url: string;
  attribution: string;
}

const cache = new Map<string, { at: number; preview: Preview | null }>();

export const previewProvider = {
  unavailableReason(): string | null {
    return process.env.ENABLE_ITUNES_PREVIEWS === "1" ? null : "Audio previews are off. Set ENABLE_ITUNES_PREVIEWS=1 to stream licensed 30s previews from Apple (attribution shown).";
  },
  async find(song: Song): Promise<Preview | null> {
    if (this.unavailableReason()) return null;
    const hit = cache.get(song.id);
    if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.preview;
    let preview: Preview | null = null;
    try {
      const q = encodeURIComponent(`${song.artist} ${song.title}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=10`, { signal: AbortSignal.timeout(4000) });
      const data = (await res.json()) as { results?: { trackName: string; artistName: string; previewUrl?: string }[] };
      const match = data.results?.find((r) => r.previewUrl && compact(r.trackName).startsWith(compact(song.title)) && compact(r.artistName).includes(compact(song.artist).slice(0, 6)));
      if (match?.previewUrl) preview = { url: match.previewUrl, attribution: "Preview provided courtesy of Apple Music / iTunes." };
    } catch {
      preview = null;
    }
    cache.set(song.id, { at: Date.now(), preview });
    return preview;
  },
};
