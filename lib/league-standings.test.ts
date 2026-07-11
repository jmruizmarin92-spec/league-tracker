import { describe, it, expect } from "vitest";
import { computeLeagueStandings } from "./league-standings";
import type { MatchInput } from "./scoring";

const cfg = { winValue: 1, drawValue: 0, attendanceValue: 1 };

describe("computeLeagueStandings", () => {
  it("aggregates wins + attendance across sessions", () => {
    const s1: MatchInput[] = [
      { player1: "a", player2: "b", result: "p1_win" },
      { player1: "a", player2: null, result: "bye" },
    ];
    const s2: MatchInput[] = [{ player1: "a", player2: "b", result: "p2_win" }];
    const rows = computeLeagueStandings([s1, s2], cfg);
    const a = rows.find((r) => r.playerId === "a")!;
    const b = rows.find((r) => r.playerId === "b")!;
    // a: 2 wins (win + bye) in s1, 0 in s2; attended both → 2*1 + 2*1 = 4
    expect(a.wins).toBe(2);
    expect(a.attended).toBe(2);
    expect(a.leaguePoints).toBe(4);
    // b: 1 win in s2; attended both → 1 + 2 = 3
    expect(b.wins).toBe(1);
    expect(b.attended).toBe(2);
    expect(b.leaguePoints).toBe(3);
    expect(a.rank).toBe(1);
  });

  it("credits attendance once per session even with multiple games", () => {
    const s1: MatchInput[] = [
      { player1: "a", player2: "b", result: "p1_win" },
      { player1: "a", player2: "c", result: "p1_win" },
    ];
    const rows = computeLeagueStandings([s1], cfg);
    expect(rows.find((r) => r.playerId === "a")!.attended).toBe(1);
  });

  it("does not credit attendance for pending-only sessions", () => {
    const s1: MatchInput[] = [
      { player1: "a", player2: "b", result: "pending" },
    ];
    const rows = computeLeagueStandings([s1], cfg);
    expect(rows.length).toBe(0);
  });

  it("respects configurable draw value", () => {
    const s1: MatchInput[] = [{ player1: "a", player2: "b", result: "draw" }];
    const rows = computeLeagueStandings([s1], {
      winValue: 3,
      drawValue: 1,
      attendanceValue: 0,
    });
    expect(rows.find((r) => r.playerId === "a")!.leaguePoints).toBe(1);
  });
});
