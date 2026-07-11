// Pure player-profile aggregation (no DB). One record per match the player
// was part of, from that player's point of view. A bye is a "win" with no
// opponent (opponentId = null) and does not enter head-to-head.
export type PlayerMatchRecord = {
  sessionId: string;
  leagueId: string;
  opponentId: string | null;
  result: "win" | "loss" | "draw";
};

export type CareerTotals = {
  wins: number;
  losses: number;
  draws: number;
  sessionsAttended: number;
};

export function computeCareerTotals(records: PlayerMatchRecord[]): CareerTotals {
  const totals: CareerTotals = { wins: 0, losses: 0, draws: 0, sessionsAttended: 0 };
  const sessions = new Set<string>();
  for (const r of records) {
    if (r.result === "win") totals.wins += 1;
    else if (r.result === "loss") totals.losses += 1;
    else totals.draws += 1;
    sessions.add(r.sessionId);
  }
  totals.sessionsAttended = sessions.size;
  return totals;
}

export type HeadToHeadRow = {
  opponentId: string;
  wins: number;
  losses: number;
  draws: number;
};

export function computeHeadToHead(records: PlayerMatchRecord[]): HeadToHeadRow[] {
  const map = new Map<string, HeadToHeadRow>();
  for (const r of records) {
    if (!r.opponentId) continue;
    let row = map.get(r.opponentId);
    if (!row) {
      row = { opponentId: r.opponentId, wins: 0, losses: 0, draws: 0 };
      map.set(r.opponentId, row);
    }
    if (r.result === "win") row.wins += 1;
    else if (r.result === "loss") row.losses += 1;
    else row.draws += 1;
  }
  return [...map.values()].sort(
    (a, b) => b.wins + b.losses + b.draws - (a.wins + a.losses + a.draws),
  );
}

export type LeaguePointConfig = {
  winValue: number;
  drawValue: number;
  attendanceValue: number;
};

export type LeagueHistoryRow = {
  leagueId: string;
  wins: number;
  losses: number;
  draws: number;
  sessionsAttended: number;
  leaguePoints: number;
};

export function computeLeagueHistory(
  records: PlayerMatchRecord[],
  configs: Map<string, LeaguePointConfig>,
): LeagueHistoryRow[] {
  const byLeague = new Map<string, PlayerMatchRecord[]>();
  for (const r of records) {
    const arr = byLeague.get(r.leagueId) ?? [];
    arr.push(r);
    byLeague.set(r.leagueId, arr);
  }

  const rows: LeagueHistoryRow[] = [];
  for (const [leagueId, recs] of byLeague) {
    const totals = computeCareerTotals(recs);
    const cfg = configs.get(leagueId) ?? {
      winValue: 1,
      drawValue: 0,
      attendanceValue: 0,
    };
    rows.push({
      leagueId,
      wins: totals.wins,
      losses: totals.losses,
      draws: totals.draws,
      sessionsAttended: totals.sessionsAttended,
      leaguePoints:
        totals.wins * cfg.winValue +
        totals.draws * cfg.drawValue +
        totals.sessionsAttended * cfg.attendanceValue,
    });
  }
  rows.sort((a, b) => b.leaguePoints - a.leaguePoints);
  return rows;
}
