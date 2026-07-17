const TZ = "Europe/Madrid";

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}

// The UTC instant marking the start of "today" in the app's timezone. Landing
// filters use this instead of "now" so a session/event stays visible for the
// whole local day it runs, rather than disappearing once its start time passes.
export function startOfTodayIso(): string {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // e.g. "2026-07-17"

  // Correct UTC midnight of that date to the timezone's local midnight by
  // measuring the tz offset there.
  const utcMidnight = new Date(`${ymd}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcMidnight);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const hour = p.hour === "24" ? 0 : +p.hour; // some engines emit "24" for midnight
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  const offset = asUtc - utcMidnight.getTime();
  return new Date(utcMidnight.getTime() - offset).toISOString();
}

export function formatCost(cost: number): string {
  if (!cost || cost <= 0) return "Gratis";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cost);
}

function formatMonth(iso: string): string {
  const s = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A league's season window, e.g. "Enero 2026 – Marzo 2026". Handles either
// end being unset, and returns null if neither is set.
export function formatMonthRange(
  startsMonth: string | null,
  endsMonth: string | null,
): string | null {
  if (startsMonth && endsMonth) {
    return `${formatMonth(startsMonth)} – ${formatMonth(endsMonth)}`;
  }
  if (startsMonth) return `Desde ${formatMonth(startsMonth)}`;
  if (endsMonth) return `Hasta ${formatMonth(endsMonth)}`;
  return null;
}
