import type { MatchInput } from "@/lib/scoring";

export type LeaguePointConfig = {
  winValue: number;
  drawValue: number;
  attendanceValue: number;
};

export type LeagueStandingRow = {
  playerId: string;
  leaguePoints: number;
  wins: number;
  draws: number;
  losses: number;
  attended: number;
  rank: number;
};

// Pure aggregation across a league's sessions. Each element of `sessions` is one
// session's matches. League points = wins*win + draws*draw + attended*attendance.
// Attendance is credited once per session in which the player played >= 1 game.
export function computeLeagueStandings(
  sessions: MatchInput[][],
  cfg: LeaguePointConfig,
): LeagueStandingRow[] {
  const agg = new Map<
    string,
    { wins: number; draws: number; losses: number; attended: number }
  >();
  const ensure = (id: string) => {
    let a = agg.get(id);
    if (!a) {
      a = { wins: 0, draws: 0, losses: 0, attended: 0 };
      agg.set(id, a);
    }
    return a;
  };

  for (const matches of sessions) {
    const played = new Set<string>();
    for (const m of matches) {
      if (m.result === "pending") continue;
      if (m.result === "bye" || m.player2 === null) {
        ensure(m.player1).wins += 1;
        played.add(m.player1);
        continue;
      }
      const p1 = ensure(m.player1);
      const p2 = ensure(m.player2);
      played.add(m.player1);
      played.add(m.player2);
      if (m.result === "p1_win") {
        p1.wins += 1;
        p2.losses += 1;
      } else if (m.result === "p2_win") {
        p2.wins += 1;
        p1.losses += 1;
      } else if (m.result === "draw") {
        p1.draws += 1;
        p2.draws += 1;
      }
    }
    for (const id of played) ensure(id).attended += 1;
  }

  const rows = [...agg.entries()].map(([playerId, a]) => ({
    playerId,
    wins: a.wins,
    draws: a.draws,
    losses: a.losses,
    attended: a.attended,
    leaguePoints:
      a.wins * cfg.winValue +
      a.draws * cfg.drawValue +
      a.attended * cfg.attendanceValue,
    rank: 0,
  }));

  rows.sort(
    (a, b) =>
      b.leaguePoints - a.leaguePoints ||
      b.wins - a.wins ||
      a.playerId.localeCompare(b.playerId),
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
