import { describe, expect, it } from "vitest";
import { splitEventHistory } from "./event-history";

const CUTOFF = "2026-09-06T00:00:00.000Z";

function ev(
  id: string,
  starts_at: string | null,
  status: "open" | "closed" | "complete" = "open",
  created_at = "2026-01-01T00:00:00.000Z",
) {
  return { id, starts_at, status, created_at };
}

describe("splitEventHistory", () => {
  it("sends completed and already-started events to past, the rest to upcoming", () => {
    const { upcoming, past } = splitEventHistory(
      [
        ev("today", "2026-09-06T10:00:00.000Z"),
        ev("yesterday", "2026-09-05T10:00:00.000Z"),
        ev("next-week", "2026-09-13T10:00:00.000Z"),
        ev("future-but-complete", "2026-09-20T10:00:00.000Z", "complete"),
        ev("old-closed", "2026-08-01T10:00:00.000Z", "closed"),
      ],
      CUTOFF,
    );
    expect(upcoming.map((e) => e.id)).toEqual(["today", "next-week"]);
    expect(past.map((e) => e.id)).toEqual(["future-but-complete", "yesterday", "old-closed"]);
  });

  it("keeps an event under upcoming for the whole day it runs", () => {
    const { upcoming, past } = splitEventHistory(
      [ev("late-today", "2026-09-06T21:30:00.000Z")],
      CUTOFF,
    );
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it("sorts upcoming soonest first and past newest first", () => {
    const { upcoming, past } = splitEventHistory(
      [
        ev("u2", "2026-10-01T10:00:00.000Z"),
        ev("u1", "2026-09-10T10:00:00.000Z"),
        ev("p1", "2026-09-01T10:00:00.000Z"),
        ev("p2", "2026-07-01T10:00:00.000Z"),
        ev("p0", "2026-09-04T10:00:00.000Z"),
      ],
      CUTOFF,
    );
    expect(upcoming.map((e) => e.id)).toEqual(["u1", "u2"]);
    expect(past.map((e) => e.id)).toEqual(["p0", "p1", "p2"]);
  });

  it("puts undated events last in upcoming, in creation order", () => {
    const { upcoming, past } = splitEventHistory(
      [
        ev("nodate-b", null, "open", "2026-02-01T00:00:00.000Z"),
        ev("dated", "2026-12-01T10:00:00.000Z"),
        ev("nodate-a", null, "open", "2026-01-01T00:00:00.000Z"),
        ev("nodate-done", null, "complete"),
      ],
      CUTOFF,
    );
    expect(upcoming.map((e) => e.id)).toEqual(["dated", "nodate-a", "nodate-b"]);
    expect(past.map((e) => e.id)).toEqual(["nodate-done"]);
  });
});
