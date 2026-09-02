import { describe, it, expect } from "vitest";
import {
  parsePlayEventPaste,
  parseStartDate,
  categoryFromType,
  composeEventName,
  gameFromProduct,
  PlayPasteError,
} from "./play-event-paste";

// Verbatim paste of a real tournament page (Mid Year Celebration, 26-08-001970),
// blank lines and all.
const SAMPLE = `Mid Year Celebration

Mid Year Celebration
League ID: 6236068



August 2, 2026 10:00AM

Mid Year Celebration
Tournament ID:
26-08-001970
League ID:
6236068
Tournament Info
Activity Group
WAR LOTUS STORE
Product
Trading Card Game
Event Type
Premier Event Series
Premier Event Series
TCG Mid Year Celebration
Format
TCG - Standard
Location
Address
NUEVA LOTUS

154 CAM. DE RDA.

GRANADA, AN, 18003

ES

Event Locator
Event Location
Country/Region
ES
Organizer Info
Name
José María Ruiz Marín
(1438667)
Email
granadapokemontcg@gmail.com
Registration Info
Website
https://warlotus.com
Players
Junior
0

Senior
0

Masters
15

Total Players
15
About
Status
Complete
Created On
July 11, 2026 6:31PM UTC
Uploaded On
August 7, 2026 12:25PM
Synced
August 7, 2026 10:36AM
`;

// Header of a League Cup page (26-09-005657): no title, the date takes its place.
const CUP_SAMPLE = `September 5, 2026 9:30AM

September 5, 2026 9:30AM
League ID: 6234028

September 5, 2026 9:30AM
Tournament ID:
26-09-005657
League ID:
6234028
Tournament Info
Activity Group
DUNE COMICS
Product
Trading Card Game
Event Type
League Cup
Premier Event Series
TCG League Cup Season 1
Format
TCG - Standard
`;

describe("parsePlayEventPaste", () => {
  it("reads every field off a real page", () => {
    const p = parsePlayEventPaste(SAMPLE);
    expect(p.name).toBe("Mid Year Celebration");
    expect(p.tournamentId).toBe("26-08-001970");
    expect(p.playLeagueId).toBe("6236068");
    expect(p.startsAtLocal).toBe("2026-08-02T10:00");
    expect(p.game).toBe("tcg");
    expect(p.format).toBe("TCG - Standard");
    expect(p.eventType).toBe("Premier Event Series");
    expect(p.series).toBe("TCG Mid Year Celebration");
    expect(p.category).toBe("others");
    expect(p.location).toBe("NUEVA LOTUS, 154 CAM. DE RDA., GRANADA, AN, 18003");
    expect(p.website).toBe("https://warlotus.com");
    expect(p.activityGroup).toBe("WAR LOTUS STORE");
    expect(p.organizer).toBe("José María Ruiz Marín");
    expect(p.players).toEqual({ junior: 0, senior: 0, masters: 15, total: 15 });
    expect(p.status).toBe("complete");
  });

  it("takes the event date, not the created/uploaded stamps", () => {
    const p = parsePlayEventPaste(SAMPLE);
    expect(p.startsAtLocal).not.toBe("2026-07-11T18:31");
    expect(p.startsAtLocal).not.toBe("2026-08-07T12:25");
  });

  it("refuses text with no tournament id", () => {
    expect(() => parsePlayEventPaste("Mid Year Celebration\nLeague ID: 1")).toThrow(
      PlayPasteError,
    );
  });

  it("copes with a partial paste: missing sections leave nulls", () => {
    const p = parsePlayEventPaste("Tournament ID:\n26-08-000001\nProduct\nVideo Game\n");
    expect(p.tournamentId).toBe("26-08-000001");
    expect(p.name).toBeNull();
    expect(p.playLeagueId).toBeNull();
    expect(p.startsAtLocal).toBeNull();
    expect(p.game).toBe("vgc");
    expect(p.location).toBeNull();
    expect(p.players).toBeNull();
    expect(p.status).toBe("open");
    expect(p.category).toBe("others");
  });

  it("treats a date as the page title as no name at all (a League Cup page)", () => {
    // Cups and challenges have no title on the Play! site; the header is the date.
    const p = parsePlayEventPaste(CUP_SAMPLE);
    expect(p.name).toBeNull();
    expect(p.series).toBe("TCG League Cup Season 1");
    expect(p.startsAtLocal).toBe("2026-09-05T09:30");
    expect(p.category).toBe("cup");
    expect(p.activityGroup).toBe("DUNE COMICS");
  });

  it("does not mistake an inline 'League ID:' header for the name", () => {
    const p = parsePlayEventPaste("League ID: 6236068\nTournament ID:\n26-08-000002\n");
    expect(p.name).toBeNull();
    expect(p.playLeagueId).toBe("6236068");
  });
});

describe("parseStartDate", () => {
  it("converts 12-hour clock to a datetime-local value", () => {
    expect(parseStartDate("August 2, 2026 10:00AM")).toBe("2026-08-02T10:00");
    expect(parseStartDate("August 2, 2026 12:00PM")).toBe("2026-08-02T12:00");
    expect(parseStartDate("August 2, 2026 12:30AM")).toBe("2026-08-02T00:30");
    expect(parseStartDate("December 25, 2026 6:31 PM")).toBe("2026-12-25T18:31");
  });

  it("rejects stamps with a zone suffix and non-dates", () => {
    expect(parseStartDate("July 11, 2026 6:31PM UTC")).toBeNull();
    expect(parseStartDate("Tournament ID:")).toBeNull();
    expect(parseStartDate("Smarch 1, 2026 1:00PM")).toBeNull();
  });
});

describe("categoryFromType", () => {
  it("maps the known series and falls back to others", () => {
    expect(categoryFromType("League Cup", null)).toBe("cup");
    expect(categoryFromType("League Challenge")).toBe("challenge");
    expect(categoryFromType("Prerelease", "Mega Evolution Prerelease")).toBe("prerelease");
    expect(categoryFromType("Premier Event Series", "TCG Mid Year Celebration")).toBe("others");
    expect(categoryFromType(null, null)).toBe("others");
  });
});

describe("gameFromProduct", () => {
  it("maps the Product line", () => {
    expect(gameFromProduct("Trading Card Game")).toBe("tcg");
    expect(gameFromProduct("Video Game")).toBe("vgc");
    expect(gameFromProduct("Pokémon GO")).toBeNull();
    expect(gameFromProduct(null)).toBeNull();
  });
});

describe("composeEventName", () => {
  it("builds '<type> <store> Q<n> <GAME>' from the series line", () => {
    expect(
      composeEventName({
        title: null,
        series: "TCG League Cup Season 1",
        eventType: "League Cup",
        game: "tcg",
        storeName: "Dune Cómics",
      }),
    ).toBe("League Cup Dune Cómics Q1 TCG");
    expect(
      composeEventName({
        title: null,
        series: "VGC League Challenge Season 2",
        eventType: "League Challenge",
        game: "vgc",
        storeName: "War Lotus",
      }),
    ).toBe("League Challenge War Lotus Q2 VGC");
  });

  it("composes even when the page has a title of its own", () => {
    expect(
      composeEventName({
        title: "Mid Year Celebration",
        series: "TCG Mid Year Celebration",
        eventType: "Premier Event Series",
        game: "tcg",
        storeName: "War Lotus",
      }),
    ).toBe("Mid Year Celebration War Lotus TCG");
  });

  it("falls back to the event type, then the title, and skips what is missing", () => {
    expect(
      composeEventName({ title: null, series: null, eventType: "League Cup", game: "tcg", storeName: null }),
    ).toBe("League Cup TCG");
    expect(
      composeEventName({ title: "Torneo de verano", series: null, eventType: null, game: null, storeName: "War Lotus" }),
    ).toBe("Torneo de verano War Lotus");
    expect(
      composeEventName({ title: null, series: null, eventType: null, game: "tcg", storeName: "War Lotus" }),
    ).toBeNull();
  });

  it("takes the game from the series token when Product is missing", () => {
    expect(
      composeEventName({ title: null, series: "VGC League Cup Season 3", eventType: null, game: null, storeName: "Dune Cómics" }),
    ).toBe("League Cup Dune Cómics Q3 VGC");
  });
});
