import { describe, it, expect } from "vitest";
import { generateSwissPairings, pairKey } from "./pairing";

describe("generateSwissPairings", () => {
  it("pairs an even field top-down", () => {
    const p = generateSwissPairings(["a", "b", "c", "d"]);
    expect(p).toEqual([
      { player1: "a", player2: "b" },
      { player1: "c", player2: "d" },
    ]);
  });

  it("gives a bye to the lowest-ranked player on an odd field", () => {
    const p = generateSwissPairings(["a", "b", "c"]);
    expect(p).toContainEqual({ player1: "c", player2: null });
    // the bye is the only null-opponent pairing
    expect(p.filter((x) => x.player2 === null)).toHaveLength(1);
    // remaining two are paired
    expect(p).toContainEqual({ player1: "a", player2: "b" });
  });

  it("avoids rematches when possible", () => {
    const played = new Set([pairKey("a", "b"), pairKey("c", "d")]);
    const p = generateSwissPairings(["a", "b", "c", "d"], played);
    for (const pair of p) {
      if (pair.player2) {
        expect(played.has(pairKey(pair.player1, pair.player2))).toBe(false);
      }
    }
  });

  it("skips a player who already had a bye when assigning the next", () => {
    const p = generateSwissPairings(["a", "b", "c"], new Set(), new Set(["c"]));
    const bye = p.find((x) => x.player2 === null)!;
    expect(bye.player1).not.toBe("c");
    expect(bye.player1).toBe("b"); // next lowest without a bye
  });

  it("falls back to a rematch if every remaining option was already played", () => {
    // Only two players who have already met — must pair again.
    const played = new Set([pairKey("a", "b")]);
    const p = generateSwissPairings(["a", "b"], played);
    expect(p).toEqual([{ player1: "a", player2: "b" }]);
  });

  it("pairs everyone (no player left unpaired) on a larger even field", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const p = generateSwissPairings(ids);
    const seen = p.flatMap((x) => [x.player1, x.player2].filter(Boolean));
    expect(new Set(seen).size).toBe(6);
    expect(p).toHaveLength(3);
  });
});
