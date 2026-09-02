import { describe, it, expect } from "vitest";
import { groupThisWeek, weekGroupKey, type WeekGroupable } from "./week-groups";

type Item = WeekGroupable & { id: string };

const session = (id: string, game: "tcg" | "vgc"): Item => ({
  id,
  kind: "session",
  game,
  category: null,
});
const event = (id: string, game: "tcg" | "vgc", category: string | null): Item => ({
  id,
  kind: "event",
  game,
  category,
});

const ids = (items: Item[]) => items.map((i) => i.id);

describe("weekGroupKey", () => {
  it("puts league sessions of either game under sessions", () => {
    expect(weekGroupKey(session("a", "tcg"))).toBe("sessions");
    expect(weekGroupKey(session("b", "vgc"))).toBe("sessions");
  });

  it("puts cups and challenges under their game", () => {
    expect(weekGroupKey(event("a", "tcg", "cup"))).toBe("tcg");
    expect(weekGroupKey(event("b", "tcg", "challenge"))).toBe("tcg");
    expect(weekGroupKey(event("c", "vgc", "cup"))).toBe("vgc");
    expect(weekGroupKey(event("d", "vgc", "challenge"))).toBe("vgc");
  });

  it("sends every other event to others, whatever the game", () => {
    expect(weekGroupKey(event("a", "tcg", "demo"))).toBe("others");
    expect(weekGroupKey(event("b", "vgc", "prerelease"))).toBe("others");
    expect(weekGroupKey(event("c", "tcg", "others"))).toBe("others");
    expect(weekGroupKey(event("d", "vgc", null))).toBe("others");
    expect(weekGroupKey(event("e", "tcg", "made-up"))).toBe("others");
  });

  it("ignores a stray category on a session", () => {
    expect(weekGroupKey({ kind: "session", game: "tcg", category: "cup" })).toBe("sessions");
  });
});

describe("groupThisWeek", () => {
  it("returns the groups in fixed order regardless of input order", () => {
    const groups = groupThisWeek([
      event("demo", "vgc", "demo"),
      event("vcup", "vgc", "cup"),
      event("tcup", "tcg", "cup"),
      session("s1", "tcg"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["sessions", "tcg", "vgc", "others"]);
  });

  it("drops the groups that have nothing", () => {
    const groups = groupThisWeek([session("s1", "tcg"), event("vcup", "vgc", "cup")]);
    expect(groups.map((g) => g.key)).toEqual(["sessions", "vgc"]);
  });

  it("returns a single group when everything is one kind", () => {
    const groups = groupThisWeek([session("s1", "tcg"), session("s2", "vgc")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("sessions");
    expect(ids(groups[0].items)).toEqual(["s1", "s2"]);
  });

  it("returns nothing for an empty week", () => {
    expect(groupThisWeek([])).toEqual([]);
  });

  it("keeps the input order inside each group", () => {
    const groups = groupThisWeek([
      event("t1", "tcg", "challenge"),
      session("s1", "vgc"),
      event("t2", "tcg", "cup"),
      session("s2", "tcg"),
      event("t3", "tcg", "challenge"),
    ]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, ids(g.items)]));
    expect(byKey.sessions).toEqual(["s1", "s2"]);
    expect(byKey.tcg).toEqual(["t1", "t2", "t3"]);
  });

  it("mixes demos and prereleases of both games in others", () => {
    const groups = groupThisWeek([
      event("d1", "tcg", "demo"),
      event("p1", "vgc", "prerelease"),
      event("o1", "tcg", "others"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("others");
    expect(ids(groups[0].items)).toEqual(["d1", "p1", "o1"]);
  });
});
