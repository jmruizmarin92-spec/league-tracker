import { describe, it, expect } from "vitest";
import {
  parseTdf,
  parseTomDate,
  pairKeyOf,
  matchTdfPlayers,
  normalizeName,
  divisionLabel,
  TdfParseError,
  type MatchablePlayer,
} from "./tdf";

// Trimmed from a real TOM export (Mid Year Celebration DUNE, 26-08-001968):
// four players, one Masters pod, one round of two matches.
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<tournament type="3" stage="4" version="1.84" gametype="TRADING_CARD_GAME" mode="TCG1DAY">
	<data>
		<name>Mid Year Celebration DUNE</name>
		<id>26-08-001968</id>
		<city>Granada</city>
		<country>Spain</country>
		<roundtime>30</roundtime>
		<organizer popid="1438667" name="Jos&#233; Mar&#237;a Ruiz"/>
		<startdate>08/01/2026</startdate>
	</data>
	<players>
		<player userid="4715652">
			<firstname>David</firstname>
			<lastname>Pérez</lastname>
			<birthdate>02/27/2004</birthdate>
		</player>
		<player userid="4327887">
			<firstname>Óscar</firstname>
			<lastname>Pérez Tobarra</lastname>
			<birthdate>02/27/1998</birthdate>
		</player>
		<player userid="1999999">
			<firstname>Ernesto</firstname>
			<lastname>González García</lastname>
			<birthdate>02/27/1990</birthdate>
		</player>
		<player userid="3940807">
			<firstname>Nerea</firstname>
			<lastname>Navarro</lastname>
			<birthdate>02/27/2003</birthdate>
		</player>
	</players>
	<pods>
		<pod category="2" stage="0">
			<rounds>
				<round number="1" type="3" stage="4" >
					<matches>
						<match outcome="1">
							<player1 userid="1999999"/>
							<player2 userid="4715652"/>
							<tablenumber>1</tablenumber>
						</match>
						<match outcome="0">
							<player1 userid="4327887"/>
							<player2 userid="3940807"/>
							<tablenumber>2</tablenumber>
						</match>
					</matches>
				</round>
			</rounds>
		</pod>
	</pods>
</tournament>`;

describe("parseTdf", () => {
  const t = parseTdf(SAMPLE);

  it("reads tournament metadata", () => {
    expect(t.tdfId).toBe("26-08-001968");
    expect(t.name).toBe("Mid Year Celebration DUNE");
    expect(t.city).toBe("Granada");
    expect(t.country).toBe("Spain");
    expect(t.startDate).toBe("2026-08-01");
    expect(t.roundMinutes).toBe(30);
  });

  it("decodes numeric entities in attributes", () => {
    expect(t.organizer).toBe("José María Ruiz");
  });

  it("reads every player with their Pokémon ID", () => {
    expect(t.players).toHaveLength(4);
    const oscar = t.players.find((p) => p.userid === "4327887");
    expect(oscar).toMatchObject({
      firstName: "Óscar",
      lastName: "Pérez Tobarra",
      birthdate: "1998-02-27",
      fullName: "Óscar Pérez Tobarra",
    });
  });

  it("reads rounds with their pod division", () => {
    expect(t.rounds).toHaveLength(1);
    expect(t.rounds[0]).toMatchObject({
      division: 2,
      number: 1,
      isFinals: false,
    });
  });

  it("maps outcome codes and table numbers", () => {
    const [played, pending] = t.rounds[0].matches;
    expect(played).toMatchObject({
      userid1: "1999999",
      userid2: "4715652",
      table: 1,
      outcomeCode: 1,
      result: "p1_win",
    });
    expect(pending.result).toBe("pending");
    expect(pending.table).toBe(2);
  });

  it("rejects a file that is not a TOM export", () => {
    expect(() => parseTdf("<html><body>nope</body></html>")).toThrow(TdfParseError);
  });

  it("rejects a tournament with no players", () => {
    expect(() => parseTdf("<tournament><players></players></tournament>")).toThrow(
      TdfParseError,
    );
  });
});

describe("byes", () => {
  // Exactly how TOM writes one, taken from a real 15-player export: outcome 5,
  // a single <player> element (not <player1>), and table number 0.
  const withBye = SAMPLE.replace(
    `<match outcome="0">
							<player1 userid="4327887"/>
							<player2 userid="3940807"/>
							<tablenumber>2</tablenumber>
						</match>`,
    `<match outcome="5">
							<player userid="4327887"/>
							<tablenumber>0</tablenumber>
						</match>`,
  );
  const bye = parseTdf(withBye).rounds[0].matches[1];

  it("reads the lone <player> element as player 1 with no opponent", () => {
    expect(bye).toMatchObject({
      userid1: "4327887",
      userid2: null,
      outcomeCode: 5,
      result: "bye",
    });
  });

  it("drops TOM's table number 0 — a bye is played at no table", () => {
    expect(bye.table).toBeNull();
  });

  it("keys the bye by its single player", () => {
    expect(bye.pairKey).toBe("4327887~bye");
  });

  it("also accepts a <player1> with no <player2>, unreported", () => {
    // Not the shape TOM produced, but cheap to tolerate rather than score a
    // one-sided pairing as pending forever.
    const loose = parseTdf(
      SAMPLE.replace(
        '<player1 userid="4327887"/>\n\t\t\t\t\t\t\t<player2 userid="3940807"/>',
        '<player1 userid="4327887"/>',
      ),
    ).rounds[0].matches[1];
    expect(loose).toMatchObject({ userid2: null, result: "bye" });
  });

  it("falls back to pending on an outcome code we do not know", () => {
    const m = parseTdf(SAMPLE.replace('outcome="1"', 'outcome="42"')).rounds[0]
      .matches[0];
    expect(m.result).toBe("pending");
    expect(m.outcomeCode).toBe(42);
  });
});

// Same tournament after the top cut is paired. Two things changed in the real
// exports and both matter: the pod's `stage` flipped 0 → 1 while the swiss
// rounds underneath it stayed put, and the cut round continues the swiss
// numbering with type="1". There is also a <standings> block now — a sibling of
// <pods>, whose per-division <pod> entries are placings, not rounds.
const SAMPLE_CUT = `<tournament type="3" stage="5" version="1.84">
	<data><name>Mid Year Celebration DUNE</name><id>26-08-001968</id></data>
	<players>
		<player userid="4715652"><firstname>David</firstname><lastname>Pérez</lastname></player>
		<player userid="4327887"><firstname>Óscar</firstname><lastname>Pérez Tobarra</lastname></player>
		<player userid="1999999"><firstname>Ernesto</firstname><lastname>González García</lastname></player>
		<player userid="3940807"><firstname>Nerea</firstname><lastname>Navarro</lastname></player>
	</players>
	<pods>
		<pod category="2" stage="1">
			<rounds>
				<round number="1" type="3" stage="6">
					<matches>
						<match outcome="1">
							<player1 userid="1999999"/><player2 userid="4715652"/>
							<tablenumber>1</tablenumber>
						</match>
						<match outcome="2">
							<player1 userid="4327887"/><player2 userid="3940807"/>
							<tablenumber>2</tablenumber>
						</match>
					</matches>
				</round>
				<round number="2" type="1" stage="8">
					<matches>
						<match outcome="1">
							<player1 userid="1999999"/><player2 userid="3940807"/>
							<tablenumber>1</tablenumber>
						</match>
					</matches>
				</round>
			</rounds>
		</pod>
	</pods>
	<standings>
		<pod category="2" type="finished">
			<player id="1999999" place="1" />
			<player id="3940807" place="2" />
			<player id="4327887" place="3" />
			<player id="4715652" place="4" />
		</pod>
		<pod category="2" type="dnf"></pod>
		<pod category="1" type="finished"></pod>
		<pod category="0" type="dnf"></pod>
	</standings>
</tournament>`;

describe("top cut", () => {
  const swiss = parseTdf(SAMPLE);
  const cut = parseTdf(SAMPLE_CUT);

  it("does not let the pod's stage flip re-key the rounds it already had", () => {
    // The pod went from stage 0 to stage 1 between the two files. Round 1 has
    // to stay round 1 of division 2, or a re-import duplicates the whole swiss.
    const before = swiss.rounds[0];
    const after = cut.rounds[0];
    expect({ division: after.division, number: after.number }).toEqual({
      division: before.division,
      number: before.number,
    });
  });

  it("flags a single-elimination round and keeps the swiss numbering", () => {
    expect(cut.rounds.map((r) => ({ n: r.number, finals: r.isFinals }))).toEqual([
      { n: 1, finals: false },
      { n: 2, finals: true },
    ]);
  });

  it("does not mistake the <standings> pods for rounds", () => {
    expect(cut.rounds).toHaveLength(2);
  });

  it("reads the official final placings", () => {
    expect(cut.standings).toEqual([
      { division: 2, userid: "1999999", place: 1 },
      { division: 2, userid: "3940807", place: 2 },
      { division: 2, userid: "4327887", place: 3 },
      { division: 2, userid: "4715652", place: 4 },
    ]);
  });

  it("has no standings before the tournament is closed", () => {
    expect(swiss.standings).toEqual([]);
  });
});

describe("a player's userid changing mid-tournament", () => {
  // Seen in the real files: a placeholder ID (1999999) was corrected to the
  // player's real one (6054871) after round 2, and TOM rewrote the earlier
  // rounds to match. The import has to land both on the same player.
  const firstImport = parseTdf(SAMPLE).players.find(
    (p) => p.userid === "1999999",
  )!;
  const db: MatchablePlayer[] = [
    {
      id: "p-ernesto",
      display_name: "Ernesto González García",
      first_name: "Ernesto",
      last_name: "González García",
      pokemon_id: "1999999",
    },
  ];

  it("still resolves the player after the ID changes", () => {
    const renamed = { ...firstImport, userid: "6054871" };
    expect(matchTdfPlayers([renamed], db, new Map())).toMatchObject([
      { playerId: "p-ernesto", source: "name" },
    ]);
  });

  it("re-keys the pairing, so the stale one gets cleaned up on re-import", () => {
    expect(pairKeyOf("1999999", "6126972")).not.toBe(
      pairKeyOf("6054871", "6126972"),
    );
  });
});

describe("pairKeyOf", () => {
  it("is stable when TOM swaps player 1 and player 2", () => {
    expect(pairKeyOf("100", "200")).toBe(pairKeyOf("200", "100"));
  });

  it("keys a bye by the single player", () => {
    expect(pairKeyOf("100", null)).toBe("100~bye");
  });
});

describe("parseTomDate", () => {
  it("reads MM/DD/YYYY", () => {
    expect(parseTomDate("08/01/2026")).toBe("2026-08-01");
    expect(parseTomDate("2/9/2025 09:17:31")).toBe("2025-02-09");
  });

  it("returns null on anything else", () => {
    expect(parseTomDate("")).toBeNull();
    expect(parseTomDate("2026-08-01")).toBeNull();
    expect(parseTomDate("13/40/2026")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("ignores accents, case and punctuation", () => {
    expect(normalizeName("Óscar  Pérez-Tobarra")).toBe("oscar perez tobarra");
  });
});

describe("matchTdfPlayers", () => {
  const players = parseTdf(SAMPLE).players;
  const db: MatchablePlayer[] = [
    {
      id: "p-david",
      display_name: "Davidón",
      first_name: "David",
      last_name: "Pérez",
      pokemon_id: "4715652",
    },
    {
      id: "p-oscar",
      display_name: "Oskr",
      first_name: "Oscar",
      last_name: "Perez Tobarra",
      pokemon_id: null,
    },
    {
      id: "p-dupe-a",
      display_name: "Nerea Navarro",
      first_name: null,
      last_name: null,
      pokemon_id: null,
    },
    {
      id: "p-dupe-b",
      display_name: "Otra",
      first_name: "Nerea",
      last_name: "Navarro",
      pokemon_id: null,
    },
  ];

  const byUserid = (userid: string) =>
    matchTdfPlayers(players, db, new Map([["1999999", "p-mapped"]])).find(
      (m) => m.userid === userid,
    )!;

  it("prefers a mapping the event already stored", () => {
    expect(byUserid("1999999")).toMatchObject({
      playerId: "p-mapped",
      source: "mapped",
    });
  });

  it("matches on Pokémon ID", () => {
    expect(byUserid("4715652")).toMatchObject({
      playerId: "p-david",
      source: "pokemon_id",
    });
  });

  it("matches on an accent-insensitive full name", () => {
    expect(byUserid("4327887")).toMatchObject({
      playerId: "p-oscar",
      source: "name",
    });
  });

  it("refuses to guess when a name matches two players", () => {
    expect(byUserid("3940807")).toMatchObject({ playerId: null, source: "none" });
  });
});

describe("divisionLabel", () => {
  it("names the known age divisions", () => {
    expect(divisionLabel(0)).toBe("Junior");
    expect(divisionLabel(2)).toBe("Master");
  });

  it("falls back for an unknown pod category", () => {
    expect(divisionLabel(7)).toBe("División 7");
  });
});
