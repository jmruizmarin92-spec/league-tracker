// A fixed light grey, independent of the theme's --secondary token (which
// is dark in dark mode and reads as "invisible" for an active filter chip).
export const ACTIVE_FILTER_CLASS =
  "border-transparent bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300";

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
