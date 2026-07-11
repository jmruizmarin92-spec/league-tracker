const TZ = "Europe/Madrid";

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
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
