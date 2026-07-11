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
