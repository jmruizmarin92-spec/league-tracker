import { describe, it, expect } from "vitest";
import { computePrizePool, QUARTER_POOL_SIZE, YEAR_POOL_SIZE } from "./prize-pool";
import { computeLeagueStandings } from "./league-standings";
import type { MatchInput } from "./scoring";

const cfg = { winValue: 1, drawValue: 0, attendanceValue: 1 };

// Builds one session's matches for `count` distinct attendees (paired up,
// odd one out gets a bye) — each attendee is credited exactly once.
function sessionOf(count: number, prefix: string): MatchInput[] {
  const matches: MatchInput[] = [];
  let i = 0;
  for (; i + 1 < count; i += 2) {
    matches.push({
      player1: `${prefix}${i}`,
      player2: `${prefix}${i + 1}`,
      result: "p1_win",
    });
  }
  if (i < count) {
    matches.push({ player1: `${prefix}${i}`, player2: null, result: "bye" });
  }
  return matches;
}

describe("computePrizePool", () => {
  it("floors total attendance divided by the pack size", () => {
    const rows = computeLeagueStandings([sessionOf(9, "p")], cfg);
    expect(computePrizePool(rows, QUARTER_POOL_SIZE)).toBe(1);
  });

  it("matches the quarter/year example across two sessions", () => {
    const s1 = sessionOf(9, "a");
    const s2 = sessionOf(11, "b");

    // Quarter pool after session 1 alone: 9 attendances / 5 = 1 pack.
    const afterS1 = computeLeagueStandings([s1], cfg);
    expect(computePrizePool(afterS1, QUARTER_POOL_SIZE)).toBe(1);

    // Quarter pool after both sessions: 20 attendances / 5 = 4 packs.
    const afterBoth = computeLeagueStandings([s1, s2], cfg);
    expect(computePrizePool(afterBoth, QUARTER_POOL_SIZE)).toBe(4);

    // Year pool after both sessions: 20 attendances / 10 = 2 packs.
    expect(computePrizePool(afterBoth, YEAR_POOL_SIZE)).toBe(2);
  });

  it("returns 0 when there are no rows", () => {
    expect(computePrizePool([], QUARTER_POOL_SIZE)).toBe(0);
  });
});
