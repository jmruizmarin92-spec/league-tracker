import { describe, it, expect } from "vitest";
import { matchSeasonLeague, formatFromPlay, type SeasonCandidate } from "./season-match";

const WAR = "store-war-lotus";
const DUNE = "store-dune";

const L = (
  id: string,
  storeId: string | null,
  game: "tcg" | "vgc",
  format: string | null,
  startsMonth: string | null,
  endsMonth: string | null,
  archived = false,
): SeasonCandidate => ({ id, storeId, game, format, startsMonth, endsMonth, archived });

// The real setup: two stores, three live seasons and last year's archived one.
const LEAGUES: SeasonCandidate[] = [
  L("war-tcg-2627", WAR, "tcg", "standard", "2026-07-01", "2027-06-01"),
  L("war-vgc-2627", WAR, "vgc", "champions", "2026-07-01", "2027-06-01"),
  L("dune-glc-2627", DUNE, "tcg", "glc", "2026-07-01", "2027-06-01"),
  L("war-tcg-2526", WAR, "tcg", "standard", "2025-07-01", "2026-06-01", true),
];

const MID_YEAR = {
  storeId: WAR,
  game: "tcg" as const,
  format: "TCG - Standard",
  startsAtLocal: "2026-08-02T10:00",
};

describe("matchSeasonLeague", () => {
  it("picks the store's league for the game, format and date", () => {
    expect(matchSeasonLeague(LEAGUES, MID_YEAR)).toEqual({ kind: "one", id: "war-tcg-2627" });
  });

  it("separates the TCG and VGC seasons of the same store", () => {
    expect(
      matchSeasonLeague(LEAGUES, { ...MID_YEAR, game: "vgc", format: "VGC" }),
    ).toEqual({ kind: "one", id: "war-vgc-2627" });
  });

  it("never crosses stores", () => {
    expect(
      matchSeasonLeague(LEAGUES, { ...MID_YEAR, storeId: DUNE }),
    ).toEqual({ kind: "none" });
  });

  it("uses the date to pick the season, falling back to archived ones", () => {
    expect(
      matchSeasonLeague(LEAGUES, { ...MID_YEAR, startsAtLocal: "2026-03-14T10:00" }),
    ).toEqual({ kind: "one", id: "war-tcg-2526" });
    expect(
      matchSeasonLeague(LEAGUES, { ...MID_YEAR, startsAtLocal: "2027-09-01T10:00" }),
    ).toEqual({ kind: "none" });
  });

  it("prefers a live season over an archived one when both cover the date", () => {
    const overlap = [...LEAGUES, L("war-tcg-old", WAR, "tcg", "standard", null, null, true)];
    expect(matchSeasonLeague(overlap, MID_YEAR)).toEqual({ kind: "one", id: "war-tcg-2627" });
  });

  it("reports ambiguity instead of guessing", () => {
    const twice = [...LEAGUES, L("war-tcg-2627-b", WAR, "tcg", "standard", "2026-07-01", "2027-06-01")];
    expect(matchSeasonLeague(twice, MID_YEAR)).toEqual({
      kind: "many",
      ids: ["war-tcg-2627", "war-tcg-2627-b"],
    });
  });

  it("does not filter on what the paste didn't say", () => {
    expect(
      matchSeasonLeague(LEAGUES, { storeId: WAR, game: null, format: null, startsAtLocal: null }),
    ).toEqual({ kind: "many", ids: ["war-tcg-2627", "war-vgc-2627"] });
  });
});

describe("formatFromPlay", () => {
  it("maps the page's format line", () => {
    expect(formatFromPlay("TCG - Standard", "tcg")).toBe("standard");
    expect(formatFromPlay("TCG - Gym Leader Challenge", "tcg")).toBe("glc");
    expect(formatFromPlay("TCG - Expanded", "tcg")).toBeNull();
    expect(formatFromPlay("anything", "vgc")).toBe("champions");
    expect(formatFromPlay(null, null)).toBeNull();
  });
});
