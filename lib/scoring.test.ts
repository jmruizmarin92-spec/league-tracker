import { describe, it, expect } from "vitest";
import { computeStandings, type MatchInput } from "./scoring";

describe("computeStandings", () => {
  it("scores a win 3 / loss 0", () => {
    const s = computeStandings(
      ["a", "b"],
      [{ player1: "a", player2: "b", result: "p1_win" }],
    );
    const a = s.find((r) => r.playerId === "a")!;
    const b = s.find((r) => r.playerId === "b")!;
    expect(a.points).toBe(3);
    expect(a.wins).toBe(1);
    expect(b.points).toBe(0);
    expect(b.losses).toBe(1);
    expect(a.rank).toBe(1);
  });

  it("scores a draw 1/1", () => {
    const s = computeStandings(
      ["a", "b"],
      [{ player1: "a", player2: "b", result: "draw" }],
    );
    expect(s.every((r) => r.points === 1 && r.draws === 1)).toBe(true);
  });

  it("counts a bye as a win", () => {
    const s = computeStandings(
      ["a"],
      [{ player1: "a", player2: null, result: "bye" }],
    );
    const a = s[0];
    expect(a.points).toBe(3);
    expect(a.wins).toBe(1);
    expect(a.byes).toBe(1);
    expect(a.played).toBe(1);
  });

  it("ignores pending matches", () => {
    const s = computeStandings(
      ["a", "b"],
      [{ player1: "a", player2: "b", result: "pending" }],
    );
    expect(s.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("includes players with no matches (0 points)", () => {
    const s = computeStandings(["a", "b", "c"], []);
    expect(s).toHaveLength(3);
    expect(s.every((r) => r.points === 0)).toBe(true);
  });

  it("breaks ties by Buchholz (opponents' points)", () => {
    // a and c both have 3 pts. a beat b (who then beats d → 3pts);
    // c beat d (0 pts after losing to b). a's opponent is stronger → a ranks first.
    const matches: MatchInput[] = [
      { player1: "a", player2: "b", result: "p1_win" },
      { player1: "c", player2: "d", result: "p1_win" },
      { player1: "b", player2: "d", result: "p1_win" },
    ];
    const s = computeStandings(["a", "b", "c", "d"], matches);
    const a = s.find((r) => r.playerId === "a")!;
    const c = s.find((r) => r.playerId === "c")!;
    expect(a.points).toBe(3);
    expect(c.points).toBe(3);
    expect(a.buchholz).toBe(3); // opponent b has 3
    expect(c.buchholz).toBe(0); // opponent d has 0
    expect(a.rank).toBeLessThan(c.rank);
  });
});
