export const TZ = "Europe/Madrid";

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

// Whether an ISO instant falls on today's calendar date in the app's timezone.
export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso)) === fmt.format(new Date());
}

// Whether an ISO instant falls later this calendar week (Mon–Sun, app
// timezone) than today — i.e. strictly after today and on or before the
// coming Sunday. Excludes today itself so it doesn't overlap isToday().
export function isThisWeek(iso: string | null): boolean {
  if (!iso) return false;
  const now = new Date();
  const ymdFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayYmd = ymdFmt.format(now);
  const itemYmd = ymdFmt.format(new Date(iso));
  if (itemYmd <= todayYmd) return false;

  const weekdayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  });
  const weekdayIndex: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const daysUntilSunday = 7 - weekdayIndex[weekdayFmt.format(now)];
  const endOfWeek = new Date(now.getTime() + daysUntilSunday * 86_400_000);
  const endOfWeekYmd = ymdFmt.format(endOfWeek);

  return itemYmd <= endOfWeekYmd;
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
