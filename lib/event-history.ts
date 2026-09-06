import type { EventRow } from "@/lib/events";

type Dated = Pick<EventRow, "starts_at" | "status" | "created_at">;

export type EventHistory<T extends Dated> = {
  // Soonest first; undated events last (creation order).
  upcoming: T[];
  // Newest first; undated ones at the end.
  past: T[];
};

/**
 * Splits standalone events into the two sections of /events (PL-30). An
 * event is past once its status is `complete` or it started before the
 * cutoff (the start of today in the app's timezone, see `startOfTodayIso`),
 * so a cup stays under Próximos for the whole day it runs — the same rule
 * the landing page uses — and moves to Anteriores the day after even if the
 * TO never flipped it to Finalizado.
 */
export function splitEventHistory<T extends Dated>(
  events: T[],
  cutoffIso: string,
): EventHistory<T> {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    const isPast = e.status === "complete" || (!!e.starts_at && e.starts_at < cutoffIso);
    (isPast ? past : upcoming).push(e);
  }
  upcoming.sort((a, b) => compareDates(a, b, 1));
  past.sort((a, b) => compareDates(a, b, -1));
  return { upcoming, past };
}

// ISO timestamps compare lexicographically; `direction` is 1 for ascending
// (soonest first) and -1 for descending (newest first). Undated events go
// last either way, oldest created first so the order is stable.
function compareDates(
  a: Pick<EventRow, "starts_at" | "created_at">,
  b: Pick<EventRow, "starts_at" | "created_at">,
  direction: 1 | -1,
): number {
  if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at) * direction;
  if (a.starts_at) return -1;
  if (b.starts_at) return 1;
  return a.created_at.localeCompare(b.created_at);
}
