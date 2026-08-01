// Entry cutoff for standalone events: registration and list submission close a
// set number of minutes before the event starts. Kept apart from lib/events.ts
// so it stays a pure, testable module with no Supabase/server imports.

export const DEFAULT_LIST_LOCK_MINUTES = 60;
export const MAX_LIST_LOCK_MINUTES = 10_080; // 7 days

type Lockable = { starts_at: string | null; list_lock_minutes: number };

// The instant registration and list submission close for players. Null when
// there's nothing to lock against: no start datetime, or the cutoff explicitly
// disabled with 0 minutes.
export function eventEntryDeadline(event: Lockable): Date | null {
  if (!event.starts_at || event.list_lock_minutes <= 0) return null;
  return new Date(
    new Date(event.starts_at).getTime() - event.list_lock_minutes * 60_000,
  );
}

// Mirrors the event_entry_locked() SQL function (0039), which is the real
// enforcement point — this only gates the UI. Event admins bypass it.
export function isEventEntryLocked(event: Lockable, now: Date = new Date()): boolean {
  const deadline = eventEntryDeadline(event);
  return !!deadline && now.getTime() >= deadline.getTime();
}
