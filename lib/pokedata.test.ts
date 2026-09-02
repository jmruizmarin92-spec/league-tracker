import { describe, it, expect } from "vitest";
import {
  gameFromPokedataProduct,
  localToIso,
  mapPokedataEvent,
  parsePokedataWhen,
  playSeasonQuarter,
  pokedataUrl,
  pokedataWindow,
  proposedEventName,
  tournamentIdFromUrl,
  type PokedataRaw,
} from "./pokedata";

// Verbatim record from the live API (2026-09-02), 30 km around Granada.
const CHALLENGE: PokedataRaw = {
  type: "League Challenge",
  name: "TCG CHALLENGE SEPTEMBER DUNE",
  date: "2026-09-05",
  shop: "ALCAZABA JUEGOS",
  street_address: "C. MONACHIL, 23, ZAIDÍN, 18007 GRANADA, SPAIN",
  state: "Andalucia",
  city: "Granada",
  postal_code: "",
  country_code: "ES",
  pokemon_url:
    "https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-005734/",
  guid: "cc5a1986-fb1a-4834-9173-6b0a7c950b23",
  latitude: "37.1565",
  longitude: "-3.60244",
  when: "2026-09-05 16:30:00",
  status: "",
  totalPlayers: "0",
  TCaccounts: "0",
  juniors: "0",
  seniors: "0",
  masters: "0",
  league: "6234028",
  category: "",
  tournament_date: "",
  tournament_completed: "",
  date_added: "2026-08-25",
  product: "tcg",
  time: "16:30:00",
  cost: "6",
  Event_website: "",
  Third_party_registration_website: "",
};

const VG_CUP: PokedataRaw = {
  ...CHALLENGE,
  type: "League Cup",
  name: "VG CUP Q1 WL",
  shop: "NUEVA LOTUS",
  street_address: "156 CAM. DE RDA., GRANADA, AN 18003, ES",
  pokemon_url:
    "https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-005660/",
  guid: "0b4c5d8f-0000-4000-8000-000000000001",
  when: "2026-09-06 10:00:00",
  league: "6236068",
  product: "vg",
  time: "10:00:00",
  cost: "",
};

describe("pokedataUrl / pokedataWindow", () => {
  it("builds the zone + window path the help page documents", () => {
    expect(
      pokedataUrl({
        latitude: 37.1773,
        longitude: -3.5986,
        radiusKm: 30,
        start: "2026-09-01",
        end: "2026-12-31",
      }),
    ).toBe(
      "https://pokedata.ovh/events/api/_tcg/cups/challenges/_vg/cups/challenges/_latitude/37.1773/_longitude/-3.5986/_radius/30/_unit/km/_start/2026-09-01/_end/2026-12-31/",
    );
  });

  it("windows from today in Europe/Madrid for 120 days", () => {
    // 23:30 UTC on the 2nd is already the 3rd in Madrid.
    expect(pokedataWindow(new Date("2026-09-02T23:30:00Z"))).toEqual({
      start: "2026-09-03",
      end: "2027-01-01",
    });
  });
});

describe("tournamentIdFromUrl", () => {
  it("reads TOM's id off the pokemon.com URL", () => {
    expect(tournamentIdFromUrl(CHALLENGE.pokemon_url)).toBe("26-09-005734");
    expect(
      tournamentIdFromUrl(
        "https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-005734",
      ),
    ).toBe("26-09-005734");
  });

  it("returns null when there is no URL or it is not a tournament page", () => {
    expect(tournamentIdFromUrl("")).toBeNull();
    expect(tournamentIdFromUrl(null)).toBeNull();
    expect(tournamentIdFromUrl("https://www.pokemon.com/us/play-pokemon/")).toBeNull();
  });
});

describe("gameFromPokedataProduct", () => {
  it("maps tcg / vg and rejects the rest", () => {
    expect(gameFromPokedataProduct("tcg")).toBe("tcg");
    expect(gameFromPokedataProduct("vg")).toBe("vgc");
    expect(gameFromPokedataProduct("VGC")).toBe("vgc");
    expect(gameFromPokedataProduct("go")).toBeNull();
    expect(gameFromPokedataProduct(undefined)).toBeNull();
  });
});

describe("playSeasonQuarter", () => {
  it("rolls on September: Sep–Nov is Season 1 of the next year's series", () => {
    expect(playSeasonQuarter("2026-09-01")).toEqual({ season: 2027, quarter: 1 });
    expect(playSeasonQuarter("2026-11-30")).toEqual({ season: 2027, quarter: 1 });
    expect(playSeasonQuarter("2026-12-01")).toEqual({ season: 2027, quarter: 2 });
    expect(playSeasonQuarter("2027-02-28")).toEqual({ season: 2027, quarter: 2 });
    expect(playSeasonQuarter("2027-03-01")).toEqual({ season: 2027, quarter: 3 });
    expect(playSeasonQuarter("2027-05-31")).toEqual({ season: 2027, quarter: 3 });
    expect(playSeasonQuarter("2027-06-01")).toEqual({ season: 2027, quarter: 4 });
    expect(playSeasonQuarter("2026-08-31")).toEqual({ season: 2026, quarter: 4 });
  });

  it("accepts a datetime-local value and rejects garbage", () => {
    expect(playSeasonQuarter("2026-09-05T16:30")).toEqual({ season: 2027, quarter: 1 });
    expect(playSeasonQuarter("")).toBeNull();
    expect(playSeasonQuarter("2026-13-01")).toBeNull();
  });
});

describe("localToIso (Europe/Madrid)", () => {
  it("applies CEST in summer and CET in winter", () => {
    expect(localToIso("2026-09-05T09:30")).toBe("2026-09-05T07:30:00.000Z");
    expect(localToIso("2026-12-12T10:00")).toBe("2026-12-12T09:00:00.000Z");
  });

  it("lands on the right side of the DST switches", () => {
    // Clocks go back at 03:00 on 25 Oct 2026, forward at 02:00 on 29 Mar 2026.
    expect(localToIso("2026-10-25T09:30")).toBe("2026-10-25T08:30:00.000Z");
    expect(localToIso("2026-10-24T23:30")).toBe("2026-10-24T21:30:00.000Z");
    expect(localToIso("2026-03-29T09:30")).toBe("2026-03-29T07:30:00.000Z");
    expect(localToIso("2026-03-28T23:30")).toBe("2026-03-28T22:30:00.000Z");
  });

  it("honours another zone and rejects a bad value", () => {
    expect(localToIso("2026-09-05T09:30", "UTC")).toBe("2026-09-05T09:30:00.000Z");
    expect(localToIso("5/9/2026")).toBeNull();
    expect(localToIso(null)).toBeNull();
  });
});

describe("parsePokedataWhen", () => {
  it("prefers `when`, falls back to date + time, then date alone", () => {
    expect(parsePokedataWhen("2026-09-05 16:30:00", null, null)).toBe("2026-09-05T16:30");
    expect(parsePokedataWhen("", "2026-09-05", "09:30:00")).toBe("2026-09-05T09:30");
    expect(parsePokedataWhen(undefined, "2026-09-05", "")).toBe("2026-09-05T00:00");
    expect(parsePokedataWhen("", "", "")).toBeNull();
  });
});

describe("mapPokedataEvent", () => {
  it("maps the live record: id, store id, game, category, instant, cost, series", () => {
    const ev = mapPokedataEvent(CHALLENGE);
    expect(ev).toMatchObject({
      guid: "cc5a1986-fb1a-4834-9173-6b0a7c950b23",
      tournamentId: "26-09-005734",
      playLeagueId: "6234028",
      eventType: "League Challenge",
      title: "TCG CHALLENGE SEPTEMBER DUNE",
      category: "challenge",
      game: "tcg",
      shop: "ALCAZABA JUEGOS",
      city: "Granada",
      location: "C. MONACHIL, 23, ZAIDÍN, 18007 GRANADA, SPAIN",
      startsAtLocal: "2026-09-05T16:30",
      startsAtIso: "2026-09-05T14:30:00.000Z",
      cost: 6,
      url: CHALLENGE.pokemon_url,
      quarter: 1,
      series: "TCG League Challenge Season 1",
    });
  });

  it("reads a VG cup as vgc, free when cost is blank", () => {
    const ev = mapPokedataEvent(VG_CUP);
    expect(ev.game).toBe("vgc");
    expect(ev.category).toBe("cup");
    expect(ev.cost).toBe(0);
    expect(ev.playLeagueId).toBe("6236068");
    expect(ev.series).toBe("VGC League Cup Season 1");
  });

  it("leaves the series out for an unsupported product and copes with blanks", () => {
    const ev = mapPokedataEvent({ ...CHALLENGE, product: "go", league: "", pokemon_url: "" });
    expect(ev.game).toBeNull();
    expect(ev.series).toBeNull();
    expect(ev.playLeagueId).toBeNull();
    expect(ev.tournamentId).toBeNull();
    expect(ev.url).toBeNull();
  });
});

describe("proposedEventName", () => {
  it("names the event like the paste does, with the quarter from the date", () => {
    expect(proposedEventName(mapPokedataEvent(CHALLENGE), "Dune Cómics")).toBe(
      "League Challenge Dune Cómics Q1 TCG",
    );
    expect(proposedEventName(mapPokedataEvent(VG_CUP), "War Lotus")).toBe(
      "League Cup War Lotus Q1 VGC",
    );
  });

  it("falls back to the shop name and drops the quarter for an unsupported product", () => {
    const ev = mapPokedataEvent({ ...CHALLENGE, product: "go" });
    expect(proposedEventName(ev, ev.shop)).toBe("League Challenge ALCAZABA JUEGOS");
  });
});
