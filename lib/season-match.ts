// Picks the season league a pasted Play! Pokémon event belongs to. The paste
// gives us the store (through its League ID), the game (Product), the format
// ("TCG - Standard") and the date; a season is one of the store's leagues
// with that game/format whose month range covers the date. Pure; unit-tested
// in season-match.test.ts.

import type { Game } from "@/lib/league-format";

export type SeasonCandidate = {
  id: string;
  storeId: string | null;
  game: Game;
  format: string | null;
  // "YYYY-MM-DD" as the DB stores them (first of the month), or null.
  startsMonth: string | null;
  endsMonth: string | null;
  archived: boolean;
};

// "TCG - Standard" → standard, "TCG - Expanded" → null (we don't run it),
// anything VGC → champions (the only VGC format we track). Null means
// "unknown, don't filter on it".
export function formatFromPlay(format: string | null, game: Game | null): string | null {
  const f = (format ?? "").toLowerCase();
  if (game === "vgc") return "champions";
  if (f.includes("standard")) return "standard";
  if (f.includes("glc") || f.includes("gym leader")) return "glc";
  return null;
}

// Month range check on "YYYY-MM" strings; a league with no range set is
// accepted (it was never told when it runs, so it can't be ruled out).
function coversMonth(c: SeasonCandidate, yyyyMm: string | null): boolean {
  if (!yyyyMm) return true;
  const start = c.startsMonth?.slice(0, 7) ?? null;
  const end = c.endsMonth?.slice(0, 7) ?? null;
  if (start && yyyyMm < start) return false;
  if (end && yyyyMm > end) return false;
  return true;
}

export type SeasonMatch =
  | { kind: "one"; id: string }
  | { kind: "none" }
  | { kind: "many"; ids: string[] };

export function matchSeasonLeague(
  leagues: SeasonCandidate[],
  input: {
    storeId: string;
    game: Game | null;
    format: string | null; // as the page prints it
    startsAtLocal: string | null; // "YYYY-MM-DDTHH:mm"
  },
): SeasonMatch {
  const wantFormat = formatFromPlay(input.format, input.game);
  const month = input.startsAtLocal ? input.startsAtLocal.slice(0, 7) : null;
  const hits = leagues.filter(
    (l) =>
      l.storeId === input.storeId &&
      (input.game === null || l.game === input.game) &&
      (wantFormat === null || l.format === null || l.format === wantFormat) &&
      coversMonth(l, month),
  );
  // A dated paste that lands inside a running season should never be sent to
  // an archived one; only fall back to archived leagues when nothing live fits
  // (a historic event from last season).
  const live = hits.filter((l) => !l.archived);
  const pool = live.length > 0 ? live : hits;
  if (pool.length === 1) return { kind: "one", id: pool[0].id };
  if (pool.length === 0) return { kind: "none" };
  return { kind: "many", ids: pool.map((l) => l.id) };
}
