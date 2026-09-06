import { describe, it, expect } from "vitest";
import {
  computePrizeBudget,
  defaultShares,
  prizeSummaryText,
  splitWhole,
  TOP_CUT_PRESETS,
  type PrizeBudgetInput,
} from "./event-prizes";

const base: PrizeBudgetInput = {
  players: 24,
  entryFee: 10,
  venueFee: 2,
  judgeFee: 1,
  entryPack: true,
  packValue: 4,
  extraCosts: 0,
  prizeKind: "packs",
  topCut: 8,
  shares: TOP_CUT_PRESETS[8],
};

describe("splitWhole", () => {
  it("returns integers that add up to the total", () => {
    const parts = splitWhole(17, [28, 20, 12, 12, 7, 7, 7, 7]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(17);
    expect(parts.every(Number.isInteger)).toBe(true);
    // 4.76 / 3.4 / 2.04 / 2.04 / 1.19 ×4 → floors leave 2 units, which go to
    // the two largest remainders (1st and 2nd place).
    expect(parts).toEqual([5, 4, 2, 2, 1, 1, 1, 1]);
  });

  it("gives the units lost to flooring to the largest remainders, earlier place first", () => {
    // 10 units, three equal weights → 3.33 each, one unit left → first place.
    expect(splitWhole(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });

  it("shares equally when every weight is zero", () => {
    expect(splitWhole(5, [0, 0])).toEqual([3, 2]);
  });

  it("handles nothing to split", () => {
    expect(splitWhole(0, [50, 50])).toEqual([0, 0]);
    expect(splitWhole(-3, [50, 50])).toEqual([0, 0]);
    expect(splitWhole(4, [])).toEqual([]);
  });

  it("ignores negative weights", () => {
    expect(splitWhole(6, [2, -1, 1])).toEqual([4, 0, 2]);
  });
});

describe("defaultShares", () => {
  it("uses the preset for the usual sizes", () => {
    for (const n of [2, 4, 8, 16]) {
      expect(defaultShares(n)).toEqual(TOP_CUT_PRESETS[n]);
      expect(defaultShares(n).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("builds a descending whole-percentage split for any other size", () => {
    const s = defaultShares(6);
    expect(s).toEqual([41, 20, 14, 10, 8, 7]);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("clamps the size", () => {
    expect(defaultShares(0)).toEqual([100]);
    expect(defaultShares(100)).toHaveLength(64);
  });
});

describe("computePrizeBudget", () => {
  it("takes every cut out and floors the pot to whole packs", () => {
    // 24 × 10 = 240; venue 48, judge 24, packs 96 → 72 left → 18 packs.
    const r = computePrizeBudget(base);
    expect(r.gross).toBe(240);
    expect(r.venueTotal).toBe(48);
    expect(r.judgeTotal).toBe(24);
    expect(r.entryPacksCount).toBe(24);
    expect(r.entryPacksCost).toBe(96);
    expect(r.remaining).toBe(72);
    expect(r.potUnits).toBe(18);
    expect(r.leftover).toBe(0);
    expect(r.awards.map((a) => a.amount)).toEqual([5, 4, 2, 2, 2, 1, 1, 1]);
  });

  it("keeps the euros a whole pack does not cover as leftover", () => {
    const r = computePrizeBudget({ ...base, players: 23, venueFee: 2.2, judgeFee: 0.7 });
    // 230 − 50.6 − 16.1 − 92 = 71.3 → 17 packs, 3.3 € over.
    expect(r.remaining).toBe(71.3);
    expect(r.potUnits).toBe(17);
    expect(r.leftover).toBe(3.3);
    expect(r.awards.reduce((a, b) => a + b.amount, 0)).toBe(17);
  });

  it("splits whole euros for store cash", () => {
    const r = computePrizeBudget({
      ...base,
      prizeKind: "cash",
      entryPack: false,
      extraCosts: 32.5,
    });
    // 240 − 48 − 24 − 32.5 = 135.5 → 135 € pot, 0.5 € leftover
    expect(r.remaining).toBe(135.5);
    expect(r.potUnits).toBe(135);
    expect(r.leftover).toBe(0.5);
    expect(r.awards.every((a) => Number.isInteger(a.amount))).toBe(true);
    expect(r.awards.reduce((a, b) => a + b.amount, 0)).toBe(135);
  });

  it("reports a deficit instead of a pot", () => {
    const r = computePrizeBudget({ ...base, players: 4, extraCosts: 50 });
    // 40 − 8 − 4 − 16 − 50 = −38
    expect(r.remaining).toBe(-38);
    expect(r.potUnits).toBe(0);
    expect(r.leftover).toBe(-38);
    expect(r.awards.every((a) => a.amount === 0)).toBe(true);
  });

  it("has no pot when packs have no value", () => {
    const r = computePrizeBudget({ ...base, entryPack: false, packValue: 0 });
    expect(r.remaining).toBe(168);
    expect(r.potUnits).toBe(0);
    expect(r.leftover).toBe(168);
  });

  it("treats shares as weights and reports normalised percentages", () => {
    const r = computePrizeBudget({ ...base, topCut: 2, shares: [3, 1] });
    expect(r.awards.map((a) => a.share)).toEqual([75, 25]);
    expect(r.awards.map((a) => a.amount)).toEqual([14, 4]);
  });

  it("pads missing shares with zero and clamps the cut", () => {
    const r = computePrizeBudget({ ...base, topCut: 3, shares: [1] });
    expect(r.awards).toHaveLength(3);
    expect(r.awards.map((a) => a.amount)).toEqual([18, 0, 0]);
    expect(computePrizeBudget({ ...base, topCut: 0 }).awards).toHaveLength(1);
  });

  it("ignores negative or fractional player counts", () => {
    expect(computePrizeBudget({ ...base, players: -5 }).gross).toBe(0);
    expect(computePrizeBudget({ ...base, players: 7.9 }).players).toBe(7);
  });
});

describe("prizeSummaryText", () => {
  const labels = {
    packOne: "sobre",
    packMany: "sobres",
    cashUnit: "€ en tienda",
    entryPackLine: "Sobre de inscripción para todos los participantes",
  };

  it("lists the placings that get something plus the entry-pack line", () => {
    const r = computePrizeBudget({ ...base, topCut: 4, shares: [50, 30, 20, 0] });
    expect(prizeSummaryText(r, "packs", labels)).toBe(
      "1º: 9 sobres\n2º: 5 sobres\n3º: 4 sobres\nSobre de inscripción para todos los participantes",
    );
  });

  it("uses the singular and the cash unit", () => {
    const r = computePrizeBudget({
      ...base,
      players: 1,
      venueFee: 0,
      judgeFee: 0,
      entryPack: false,
      packValue: 9,
      topCut: 1,
      shares: [100],
    });
    expect(prizeSummaryText(r, "packs", labels)).toBe("1º: 1 sobre");
    const cash = computePrizeBudget({
      ...base,
      prizeKind: "cash",
      entryPack: false,
      topCut: 1,
      shares: [100],
    });
    expect(prizeSummaryText(cash, "cash", labels)).toBe("1º: 168 € en tienda");
  });

  it("is empty when nothing is handed out", () => {
    const r = computePrizeBudget({ ...base, players: 0 });
    expect(prizeSummaryText(r, "packs", labels)).toBe("");
  });
});
