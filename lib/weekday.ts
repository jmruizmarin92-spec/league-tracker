// 0 = Sunday .. 6 = Saturday, matching both JS Date.getDay() and Postgres
// extract(dow from date), so the frontend and the generate_league_sessions
// RPC agree on the same numbering without translation.
export const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

export function weekdayLabel(value: number | null): string | null {
  if (value == null) return null;
  return WEEKDAYS.find((w) => w.value === value)?.label ?? null;
}

// "16:30:00" (Postgres time) -> "16:30"
export function formatTimeOfDay(time: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}
