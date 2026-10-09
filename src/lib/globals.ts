/**
 * Process-wide singletons. The Next.js bundle and the custom Socket.IO server load separate
 * copies of our modules, so shared state MUST live on globalThis.
 */
export function singleton<T>(key: string, create: () => T): T {
  const g = globalThis as unknown as Record<string, T>;
  const k = `__pv_${key}`;
  if (!(k in g)) g[k] = create();
  return g[k];
}
