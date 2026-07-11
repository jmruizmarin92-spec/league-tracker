// Builds a link that sets/clears game+category query params while
// preserving whichever of the two isn't being changed.
export function buildFilterHref(
  basePath: string,
  current: { game?: string; category?: string },
  patch: { game?: string; category?: string },
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.game) params.set("game", next.game);
  if (next.category) params.set("category", next.category);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
