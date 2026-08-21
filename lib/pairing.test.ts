import { describe, it, expect } from "vitest";
import {
  generateSwissPairings,
  repairSwissPairings,
  pairKey,
  recommendedRoundCount,
  type Pairing,
  type SeatedPairing,
} from "./pairing";

function playedKeys(p: Pairing[]): string[] {
  return p
    .filter((x) => x.player2)
    .map((x) => pairKey(x.player1, x.player2 as string));
}

function expectNoRematch(p: Pairing[], played: Set<string>) {
  for (const k of playedKeys(p)) expect(played.has(k)).toBe(false);
}

function expectEveryoneOnce(p: Pairing[], ids: string[]) {
  const seen = p.flatMap((x) => [x.player1, x.player2].filter(Boolean));
  expect(seen.sort()).toEqual([...ids].sort());
}

describe("generateSwissPairings", () => {
  it("pairs an even field top-down", () => {
    const p = generateSwissPairings(["a", "b", "c", "d"]);
    expect(p).toEqual([
      { player1: "a", player2: "b" },
      { player1: "c", player2: "d" },
    ]);
  });

  it("gives a bye to the lowest-ranked player on an odd field", () => {
    const p = generateSwissPairings(["a", "b", "c"])!;
    expect(p).toContainEqual({ player1: "c", player2: null });
    // the bye is the only null-opponent pairing
    expect(p.filter((x) => x.player2 === null)).toHaveLength(1);
    // remaining two are paired
    expect(p).toContainEqual({ player1: "a", player2: "b" });
  });

  it("returns the bye as the last pairing", () => {
    const p = generateSwissPairings(["a", "b", "c"])!;
    expect(p.at(-1)).toEqual({ player1: "c", player2: null });
  });

  it("avoids rematches when possible", () => {
    const played = new Set([pairKey("a", "b"), pairKey("c", "d")]);
    const p = generateSwissPairings(["a", "b", "c", "d"], played)!;
    expectNoRematch(p, played);
  });

  it("backtracks instead of leaving the bottom pair with a rematch", () => {
    // Greedy would pair a–b and then be stuck with c–d again.
    const played = new Set([pairKey("c", "d")]);
    const p = generateSwissPairings(["a", "b", "c", "d"], played)!;
    expect(p).toEqual([
      { player1: "a", player2: "c" },
      { player1: "b", player2: "d" },
    ]);
  });

  it("never repeats a matchup across a full round-robin", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const played = new Set<string>();
    for (let round = 1; round <= ids.length - 1; round++) {
      const p = generateSwissPairings(ids, played);
      expect(p, `round ${round}`).not.toBeNull();
      expectNoRematch(p!, played);
      expectEveryoneOnce(p!, ids);
      for (const k of playedKeys(p!)) played.add(k);
    }
  });

  it("skips a player who already had a bye when assigning the next", () => {
    const p = generateSwissPairings(["a", "b", "c"], new Set(), new Set(["c"]))!;
    const bye = p.find((x) => x.player2 === null)!;
    expect(bye.player1).not.toBe("c");
    expect(bye.player1).toBe("b"); // next lowest without a bye
  });

  it("moves the bye up the standings when that is the only fresh pairing", () => {
    // e would get the bye by default, but then a has to pair inside a,b,c,d and
    // has already met all three. Moving the bye one step up (to d) frees a–e.
    const played = new Set([pairKey("a", "b"), pairKey("a", "c"), pairKey("a", "d")]);
    const p = generateSwissPairings(["a", "b", "c", "d", "e"], played)!;
    expectNoRematch(p, played);
    expectEveryoneOnce(p, ["a", "b", "c", "d", "e"]);
    const bye = p.find((x) => x.player2 === null)!;
    expect(bye.player1).toBe("d"); // lowest bye-eligible player that unlocks a fresh pairing
  });

  it("gives the bye to someone who already had one before allowing a rematch", () => {
    // Everyone has met everyone except c–d; the only fresh pairing needs a bye
    // on a or b, both of whom already had one.
    const played = new Set([
      pairKey("a", "b"),
      pairKey("a", "c"),
      pairKey("a", "d"),
      pairKey("b", "c"),
      pairKey("b", "d"),
    ]);
    const p = generateSwissPairings(["a", "b", "c", "d", "e"], played, new Set(["a", "b"]))!;
    expect(p).not.toBeNull();
    expectNoRematch(p, played);
  });

  it("returns null when the only option is a rematch", () => {
    // Only two players who have already met — refuse, don't repeat.
    const played = new Set([pairKey("a", "b")]);
    expect(generateSwissPairings(["a", "b"], played)).toBeNull();
  });

  it("returns null when the field is exhausted on an odd count too", () => {
    const played = new Set([pairKey("a", "b"), pairKey("a", "c"), pairKey("b", "c")]);
    expect(generateSwissPairings(["a", "b", "c"], played)).toBeNull();
  });

  it("pairs everyone (no player left unpaired) on a larger even field", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const p = generateSwissPairings(ids)!;
    expectEveryoneOnce(p, ids);
    expect(p).toHaveLength(3);
  });

  it("handles a league-sized field with several rounds played quickly", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `p${String(i).padStart(2, "0")}`);
    const played = new Set<string>();
    for (let round = 1; round <= 8; round++) {
      const p = generateSwissPairings(ids, played);
      expect(p, `round ${round}`).not.toBeNull();
      expectNoRematch(p!, played);
      expectEveryoneOnce(p!, ids);
      for (const k of playedKeys(p!)) played.add(k);
    }
  });
});

describe("repairSwissPairings", () => {
  // Eight players ranked a..h, paired top-down: a–b (1), c–d (2), e–f (3), g–h (4).
  const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const seat = (p: Pairing[]): SeatedPairing[] => {
    let t = 0;
    return p.map((x) => ({ ...x, table: x.player2 === null ? null : ++t }));
  };
  const posted8 = seat(generateSwissPairings(eight)!);

  it("returns the posted pairing unchanged when nothing changed", () => {
    expect(repairSwissPairings(eight, posted8)).toEqual(posted8);
  });

  it("gives the orphan a bye when their opponent drops from an even field", () => {
    // d drops: c is left alone, no bye to fill.
    const r = repairSwissPairings(
      eight.filter((x) => x !== "d"),
      posted8,
    )!;
    expect(r).toEqual([
      { player1: "a", player2: "b", table: 1 },
      { player1: "e", player2: "f", table: 3 },
      { player1: "g", player2: "h", table: 4 },
      { player1: "c", player2: null, table: null },
    ]);
  });

  it("pairs the orphan with the bye holder, keeping every other table", () => {
    // Nine players: i has the bye. d drops -> c plays i at the freed table 2.
    const nine = [...eight, "i"];
    const posted = seat(generateSwissPairings(nine)!);
    expect(posted.at(-1)).toEqual({ player1: "i", player2: null, table: null });
    const r = repairSwissPairings(
      nine.filter((x) => x !== "d"),
      posted,
    )!;
    expect(r).toEqual([
      { player1: "a", player2: "b", table: 1 },
      { player1: "c", player2: "i", table: 2 },
      { player1: "e", player2: "f", table: 3 },
      { player1: "g", player2: "h", table: 4 },
    ]);
  });

  it("seats a late joiner against the bye holder", () => {
    const nine = [...eight, "i"];
    const posted = seat(generateSwissPairings(nine)!);
    const r = repairSwissPairings([...nine, "j"], posted)!;
    expect(r.slice(0, 4)).toEqual(posted.slice(0, 4));
    expect(r[4]).toEqual({ player1: "i", player2: "j", table: 5 });
  });

  it("gives a late joiner the bye on an even field", () => {
    const r = repairSwissPairings([...eight, "i"], posted8)!;
    expect(r.slice(0, 4)).toEqual(posted8);
    expect(r[4]).toEqual({ player1: "i", player2: null, table: null });
  });

  it("dissolves the lowest table when the orphan and the bye holder already met", () => {
    const nine = [...eight, "i"];
    const posted = seat(generateSwissPairings(nine)!);
    const played = new Set([pairKey("c", "i")]);
    const r = repairSwissPairings(
      nine.filter((x) => x !== "d"),
      posted,
      played,
    )!;
    // Tables 1 and 3 untouched; c, i, g, h re-paired fresh on tables 2 and 4.
    expect(r).toContainEqual({ player1: "a", player2: "b", table: 1 });
    expect(r).toContainEqual({ player1: "e", player2: "f", table: 3 });
    expectNoRematch(r, played);
    expectEveryoneOnce(r, nine.filter((x) => x !== "d"));
    expect(r.map((x) => x.table)).toEqual([1, 2, 3, 4]);
    const bottom = r.filter((x) => x.table === 2 || x.table === 4);
    expect(bottom.flatMap((x) => [x.player1, x.player2]).sort()).toEqual(
      ["c", "g", "h", "i"],
    );
  });

  it("falls back to a full re-pair when no partial fix exists", () => {
    // Five players posted a–b (1), c–d (2), e bye. d drops and c has already
    // met e: the pool {c, e} is a rematch, so table 1 is dissolved too and
    // a, b, c, e are re-paired from scratch.
    const five = ["a", "b", "c", "d", "e"];
    const posted = seat(generateSwissPairings(five)!);
    const played = new Set([pairKey("c", "e")]);
    const r = repairSwissPairings(
      ["a", "b", "c", "e"],
      posted,
      played,
    )!;
    expectNoRematch(r, played);
    expectEveryoneOnce(r, ["a", "b", "c", "e"]);
    expect(r.map((x) => x.table)).toEqual([1, 2]);
  });

  it("does not second-guess an intact table, even if it is a rematch", () => {
    // Posted a–b (1), c–d (2). d drops. a–b is intact and stays as posted (the
    // repair only re-pairs what the roster change broke); c takes the bye.
    const four = ["a", "b", "c", "d"];
    const posted = seat(generateSwissPairings(four)!);
    const played = new Set([
      pairKey("a", "b"),
      pairKey("a", "c"),
      pairKey("b", "c"),
    ]);
    expect(repairSwissPairings(["a", "b", "c"], posted, played)).toEqual([
      { player1: "a", player2: "b", table: 1 },
      { player1: "c", player2: null, table: null },
    ]);
  });

  it("returns null when no rematch-free pairing exists at all", () => {
    // Posted a–b (1), c–d (2). d drops, e joins, and every pair among
    // a, b, c, e has already been played: neither the pool {c, e} nor the
    // full field can be paired fresh.
    const four = ["a", "b", "c", "d"];
    const posted = seat(generateSwissPairings(four)!);
    const played = new Set([
      pairKey("c", "e"),
      pairKey("a", "c"),
      pairKey("a", "e"),
      pairKey("b", "c"),
      pairKey("b", "e"),
      pairKey("a", "b"),
    ]);
    expect(repairSwissPairings(["a", "b", "c", "e"], posted, played)).toBeNull();
  });

  it("keeps every intact table even if the orphan already had a bye", () => {
    // Six players posted a–b, c–d, e–f. f drops; e already had a bye, but a
    // second one is preferable to dissolving a table that is still valid.
    const six = ["a", "b", "c", "d", "e", "f"];
    const posted = seat(generateSwissPairings(six)!);
    const r = repairSwissPairings(
      ["a", "b", "c", "d", "e"],
      posted,
      new Set(),
      new Set(["e"]),
    )!;
    expect(r).toEqual([
      { player1: "a", player2: "b", table: 1 },
      { player1: "c", player2: "d", table: 2 },
      { player1: "e", player2: null, table: null },
    ]);
  });

  it("numbers a kept table that had no number (bye filled by a late joiner)", () => {
    const posted: SeatedPairing[] = [
      { player1: "a", player2: "b", table: 1 },
      { player1: "c", player2: "d", table: 2 },
      { player1: "e", player2: "f", table: null },
    ];
    const r = repairSwissPairings(["a", "b", "c", "d", "e", "f"], posted)!;
    expect(r).toEqual([
      { player1: "a", player2: "b", table: 1 },
      { player1: "c", player2: "d", table: 2 },
      { player1: "e", player2: "f", table: 3 },
    ]);
  });
});

describe("recommendedRoundCount", () => {
  it("returns 0 for an empty or single-player field", () => {
    expect(recommendedRoundCount(0)).toBe(0);
    expect(recommendedRoundCount(1)).toBe(0);
  });

  it("falls back to a full round-robin below the official table", () => {
    expect(recommendedRoundCount(2)).toBe(1);
    expect(recommendedRoundCount(3)).toBe(2);
  });

  it("matches the official Play! Pokémon Swiss table", () => {
    expect(recommendedRoundCount(4)).toBe(3);
    expect(recommendedRoundCount(8)).toBe(3);
    expect(recommendedRoundCount(9)).toBe(4);
    expect(recommendedRoundCount(16)).toBe(4);
    expect(recommendedRoundCount(17)).toBe(5);
    expect(recommendedRoundCount(32)).toBe(5);
    expect(recommendedRoundCount(33)).toBe(6);
    expect(recommendedRoundCount(64)).toBe(6);
    expect(recommendedRoundCount(65)).toBe(7);
    expect(recommendedRoundCount(128)).toBe(7);
    expect(recommendedRoundCount(226)).toBe(8);
    expect(recommendedRoundCount(409)).toBe(9);
  });

  it("extrapolates beyond the table with log2", () => {
    expect(recommendedRoundCount(2507)).toBe(Math.ceil(Math.log2(2507)) + 4);
  });
});
