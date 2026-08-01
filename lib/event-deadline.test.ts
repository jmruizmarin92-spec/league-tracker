import { describe, it, expect } from "vitest";
import {
  eventEntryDeadline,
  isEventEntryLocked,
  DEFAULT_LIST_LOCK_MINUTES,
} from "./event-deadline";

const start = "2026-08-01T10:00:00.000Z";

describe("eventEntryDeadline", () => {
  it("subtracts the configured minutes from the start time", () => {
    const d = eventEntryDeadline({ starts_at: start, list_lock_minutes: 60 });
    expect(d?.toISOString()).toBe("2026-08-01T09:00:00.000Z");
  });

  it("has no deadline without a start time", () => {
    expect(eventEntryDeadline({ starts_at: null, list_lock_minutes: 60 })).toBeNull();
  });

  it("has no deadline when the cutoff is disabled with 0", () => {
    expect(eventEntryDeadline({ starts_at: start, list_lock_minutes: 0 })).toBeNull();
  });
});

describe("isEventEntryLocked", () => {
  const event = { starts_at: start, list_lock_minutes: DEFAULT_LIST_LOCK_MINUTES };

  it("stays open a minute before the deadline", () => {
    expect(isEventEntryLocked(event, new Date("2026-08-01T08:59:00Z"))).toBe(false);
  });

  it("locks exactly on the deadline", () => {
    expect(isEventEntryLocked(event, new Date("2026-08-01T09:00:00Z"))).toBe(true);
  });

  it("stays locked after the event has started", () => {
    expect(isEventEntryLocked(event, new Date("2026-08-01T12:30:00Z"))).toBe(true);
  });

  it("never locks a dateless event", () => {
    expect(
      isEventEntryLocked({ starts_at: null, list_lock_minutes: 60 }, new Date(start)),
    ).toBe(false);
  });

  it("never locks when the cutoff is 0", () => {
    expect(
      isEventEntryLocked({ starts_at: start, list_lock_minutes: 0 }, new Date(start)),
    ).toBe(false);
  });
});
