// Builds a link that sets/clears arbitrary query params while preserving
// whichever ones aren't being changed. Generic over the param names so it
// works for {game, category} on /events and {game, type} on the landing page.
export function buildFilterHref(
  basePath: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
