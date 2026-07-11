import { describe, it, expect } from "vitest";
import {
  computeCareerTotals,
  computeHeadToHead,
  computeLeagueHistory,
  type PlayerMatchRecord,
} from "./player-profile";

const rec = (
  sessionId: string,
  leagueId: string,
  opponentId: string | null,
  result: "win" | "loss" | "draw",
): PlayerMatchRecord => ({ sessionId, leagueId, opponentId, result });

describe("computeCareerTotals", () => {
  it("tallies wins/losses/draws and distinct sessions", () => {
    const records = [
      rec("s1", "l1", "b", "win"),
      rec("s1", "l1", null, "win"), // bye, same session
      rec("s2", "l1", "c", "loss"),
    ];
    const totals = computeCareerTotals(records);
    expect(totals.wins).toBe(2);
    expect(totals.losses).toBe(1);
    expect(totals.draws).toBe(0);
    expect(totals.sessionsAttended).toBe(2);
  });
});

describe("computeHeadToHead", () => {
  it("groups by opponent and excludes byes", () => {
    const records = [
      rec("s1", "l1", "b", "win"),
      rec("s2", "l1", "b", "loss"),
      rec("s3", "l1", null, "win"), // bye
      rec("s4", "l1", "c", "draw"),
    ];
    const h2h = computeHeadToHead(records);
    const vsB = h2h.find((r) => r.opponentId === "b")!;
    expect(vsB.wins).toBe(1);
    expect(vsB.losses).toBe(1);
    const vsC = h2h.find((r) => r.opponentId === "c")!;
    expect(vsC.draws).toBe(1);
    expect(h2h.find((r) => r.opponentId === null as unknown as string)).toBeUndefined();
  });
});

describe("computeLeagueHistory", () => {
  it("aggregates per league using that league's point config", () => {
    const records = [
      rec("s1", "l1", "b", "win"),
      rec("s1", "l1", null, "win"),
      rec("s2", "l2", "c", "loss"),
    ];
    const configs = new Map([
      ["l1", { winValue: 1, drawValue: 0, attendanceValue: 1 }],
      ["l2", { winValue: 3, drawValue: 1, attendanceValue: 0 }],
    ]);
    const rows = computeLeagueHistory(records, configs);
    const l1 = rows.find((r) => r.leagueId === "l1")!;
    const l2 = rows.find((r) => r.leagueId === "l2")!;
    // l1: 2 wins, 1 session attended -> 2*1 + 1*1 = 3
    expect(l1.leaguePoints).toBe(3);
    // l2: 0 wins, 1 session attended -> 0
    expect(l2.leaguePoints).toBe(0);
    expect(l2.losses).toBe(1);
  });

  it("defaults to a sane config when a league isn't in the map", () => {
    const rows = computeLeagueHistory([rec("s1", "l9", "b", "win")], new Map());
    expect(rows[0].leaguePoints).toBe(1); // default winValue 1, attendanceValue 0
  });
});
