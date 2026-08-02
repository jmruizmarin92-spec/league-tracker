import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseTdf, matchTdfPlayers, type MatchablePlayer } from "./tdf";

// End-to-end replay of a real tournament: every export TOM wrote for
// "Mid Year Celebration DUNE", imported in order the way a TO would on the day.
// This is the test that catches keying mistakes — a wrong round key duplicates
// the swiss when the cut starts, and a wrong player key duplicates a person
// when their Pokémon ID is corrected mid-event. Both happened in this data.
//
// The fixtures are real exports with real names, birthdates and Pokémon IDs, so
// they live outside the repo (TOMFiles/). The suite skips itself when they
// aren't there instead of failing.

const DIR = "TOMFiles";
const BASE = `${DIR}/Mid Year Celebration DUNE_26-08-001968`;
const FILES = [
  `${BASE}_r0-start.tdf`,
  `${BASE}_r1-begin.tdf`,
  `${BASE}_r1-end.tdf`,
  `${BASE}_r2-begin.tdf`,
  `${BASE}_r2-end.tdf`,
  `${BASE}_r3-begin.tdf`,
  `${BASE}_r3-end.tdf`,
  `${BASE}_r4-begin.tdf`,
  `${BASE}_r4-end.tdf`,
  `${BASE}_r5-begin.tdf`,
  `${BASE}_r5-end.tdf`,
  `${BASE}_r6-begin.tdf`,
  `${DIR}/END_Mid Year Celebration DUNE_26-08-001968.tdf`,
];

const available = FILES.every((f) => existsSync(f));

type ImportedRound = { isFinals: boolean; matches: Map<string, string> };

// Same upsert rules as import_event_tdf (0041): rounds keyed by
// (division, number), pairings by (round, pair_key), and pair_keys the file
// stopped listing are dropped from that round.
function replay(files: string[]) {
  const db: MatchablePlayer[] = [];
  const mapping = new Map<string, string>();
  const rounds = new Map<string, ImportedRound>();
  let places: { userid: string; place: number }[] = [];
  let created = 0;

  for (const file of files) {
    const tdf = parseTdf(readFileSync(file, "utf8"));

    // The review step, with the TO accepting every suggestion.
    for (const m of matchTdfPlayers(tdf.players, db, mapping)) {
      let id = m.playerId;
      if (!id) {
        id = `player-${++created}`;
        db.push({
          id,
          display_name: m.fullName,
          first_name: m.firstName,
          last_name: m.lastName,
          pokemon_id: m.userid,
        });
      }
      mapping.set(m.userid, id);
    }

    for (const r of tdf.rounds) {
      const key = `${r.division}-${r.number}`;
      const round: ImportedRound = {
        isFinals: r.isFinals,
        matches: new Map(rounds.get(key)?.matches),
      };
      const listed = new Set<string>();
      for (const m of r.matches) {
        round.matches.set(m.pairKey, m.result);
        listed.add(m.pairKey);
      }
      for (const k of [...round.matches.keys()]) {
        if (!listed.has(k)) round.matches.delete(k);
      }
      rounds.set(key, round);
    }

    if (tdf.standings.length > 0) {
      places = tdf.standings.map((s) => ({ userid: s.userid, place: s.place }));
    }
  }

  return { rounds, mapping, places, created };
}

describe.skipIf(!available)("replaying a real tournament", () => {
  const { rounds, mapping, places, created } = replay(FILES);
  const end = parseTdf(readFileSync(FILES[FILES.length - 1], "utf8"));

  it("creates one player per entrant, even when a Pokémon ID is corrected", () => {
    // 1999999 (a placeholder) became 6054871 after round 2 and TOM rewrote the
    // earlier rounds. The name match has to land it on the same person.
    expect(created).toBe(10);
    expect(mapping.get("1999999")).toBe(mapping.get("6054871"));
  });

  it("ends with exactly the rounds of the final export", () => {
    // The pod's stage flips 0 → 1 when the cut is paired. Keyed on that, the
    // four swiss rounds would come back as duplicates here.
    expect([...rounds.keys()].sort()).toEqual(
      end.rounds.map((r) => `${r.division}-${r.number}`).sort(),
    );
  });

  it("ends with exactly the pairings and results of the final export", () => {
    for (const r of end.rounds) {
      const got = rounds.get(`${r.division}-${r.number}`);
      expect(got, `round ${r.number}`).toBeDefined();
      expect([...got!.matches.entries()].sort()).toEqual(
        r.matches.map((m) => [m.pairKey, m.result] as [string, string]).sort(),
      );
      expect(got!.isFinals).toBe(r.isFinals);
    }
  });

  it("marks the top cut and keeps the swiss numbering", () => {
    expect(end.rounds.map((r) => [r.number, r.isFinals])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
      [5, true],
      [6, true],
    ]);
  });

  it("picks up the official final placings", () => {
    expect(places).toHaveLength(10);
    expect(places.map((p) => p.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const p of places) expect(mapping.get(p.userid)).toBeTruthy();
  });
});

// A second real export, from an odd-sized event, purely to pin down the bye.
const BYE_FILE = "tombye/MID YEAR LOTUS_26-08-001970.tdf";

describe.skipIf(!existsSync(BYE_FILE))("a real bye", () => {
  const round = parseTdf(readFileSync(BYE_FILE, "utf8")).rounds[0];
  const byes = round.matches.filter((m) => m.userid2 === null);

  it("gives the odd player out exactly one bye", () => {
    // 15 players: 7 pairings plus the bye.
    expect(round.matches).toHaveLength(8);
    expect(byes).toHaveLength(1);
  });

  it("reads it as a bye at no table", () => {
    expect(byes[0]).toMatchObject({
      outcomeCode: 5,
      result: "bye",
      table: null,
      pairKey: `${byes[0].userid1}~bye`,
    });
  });
});
