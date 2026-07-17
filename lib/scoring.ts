// Pure session-scoring logic (no DB). Unit-tested in scoring.test.ts.
//
// Within a session: Win = 3, Draw = 1, Loss = 0. A bye counts as a win.
// Standings order: points, then Opponents' Win % (OWP), then wins.
//
// OWP (the first tiebreaker) is the standard Pokémon metric: the average, over
// every opponent actually faced, of that opponent's match-win rate. Following
// official rules, each opponent's win rate excludes their byes and is floored
// at 25%, so a single winless opponent can't tank the tiebreaker. Byes and
// solo losses have no opponent, so they add nobody to the average.

export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;
export const LOSS_POINTS = 0;

export type MatchResult =
  | "pending"
  | "p1_win"
  | "p2_win"
  | "draw"
  | "bye"
  | "loss"; // solo loss (player2 null): player1 lost a round they weren't there for

export type MatchInput = {
  player1: string;
  player2: string | null; // null = bye
  result: MatchResult;
};

export type StandingRow = {
  playerId: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  played: number;
  oppWinRate: number; // Opponents' Win % (OWP), 0..1
  rank: number;
};

// Official Pokémon OWP floors each opponent's win rate at 25% and excludes
// their byes from the calculation.
const MIN_WIN_RATE = 0.25;

function winRate(row: StandingRow): number {
  const games = row.played - row.byes; // real games only (byes excluded)
  if (games <= 0) return MIN_WIN_RATE;
  return Math.max(MIN_WIN_RATE, (row.wins - row.byes) / games);
}

export function computeStandings(
  playerIds: string[],
  matches: MatchInput[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const opponents = new Map<string, string[]>();

  for (const id of playerIds) {
    rows.set(id, {
      playerId: id,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      byes: 0,
      played: 0,
      oppWinRate: 0,
      rank: 0,
    });
    opponents.set(id, []);
  }

  const ensure = (id: string) => {
    if (!rows.has(id)) {
      rows.set(id, {
        playerId: id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        byes: 0,
        played: 0,
        oppWinRate: 0,
        rank: 0,
      });
      opponents.set(id, []);
    }
    return rows.get(id)!;
  };

  for (const m of matches) {
    if (m.result === "pending") continue;

    // Solo loss for a missed round: 0 pts, counts as played, no opponent.
    // Checked before the bye branch because a loss also has player2 === null.
    if (m.result === "loss") {
      const p = ensure(m.player1);
      p.losses += 1;
      p.played += 1;
      continue;
    }

    if (m.result === "bye" || m.player2 === null) {
      const p = ensure(m.player1);
      p.points += WIN_POINTS;
      p.wins += 1;
      p.byes += 1;
      p.played += 1;
      continue;
    }

    const p1 = ensure(m.player1);
    const p2 = ensure(m.player2);
    opponents.get(m.player1)!.push(m.player2);
    opponents.get(m.player2)!.push(m.player1);
    p1.played += 1;
    p2.played += 1;

    if (m.result === "p1_win") {
      p1.points += WIN_POINTS;
      p1.wins += 1;
      p2.losses += 1;
    } else if (m.result === "p2_win") {
      p2.points += WIN_POINTS;
      p2.wins += 1;
      p1.losses += 1;
    } else if (m.result === "draw") {
      p1.points += DRAW_POINTS;
      p2.points += DRAW_POINTS;
      p1.draws += 1;
      p2.draws += 1;
    }
  }

  // OWP = average win rate of the opponents actually faced (byes excluded).
  for (const [id, opps] of opponents) {
    const row = rows.get(id)!;
    row.oppWinRate =
      opps.length === 0
        ? 0
        : opps.reduce((sum, o) => sum + winRate(rows.get(o)!), 0) / opps.length;
  }

  const ordered = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.oppWinRate - a.oppWinRate ||
      b.wins - a.wins ||
      a.playerId.localeCompare(b.playerId),
  );
  ordered.forEach((r, i) => (r.rank = i + 1));
  return ordered;
}
