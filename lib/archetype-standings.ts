import { createClient } from "@/lib/supabase/server";
import { resolveArchetypes, type ArchetypeChip } from "@/lib/archetypes";

export type ArchetypeStatRow = {
  key: string;
  chip: ArchetypeChip | null;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number; // wins / games, 0..1
  players: number; // distinct players who've publicly used this archetype
};

type MatchRow = {
  session_id: string;
  player1_id: string;
  player2_id: string | null;
  result: "pending" | "p1_win" | "p2_win" | "draw" | "bye" | "loss";
};

type ParticipantRow = {
  session_id: string;
  player_id: string;
  archetype1: string | null;
  archetype2: string | null;
};

// Per-archetype usage + win/loss/draw across every session in a league.
// Only public picks count; a match credits every archetype slot the player
// declared for that session (a two-archetype pick counts toward both).
export async function computeLeagueArchetypeStats(
  leagueId: string,
): Promise<ArchetypeStatRow[]> {
  const supabase = await createClient();

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id")
    .eq("league_id", leagueId);
  const sessionIds = ((sessionRows as { id: string }[] | null) ?? []).map(
    (s) => s.id,
  );
  if (sessionIds.length === 0) return [];

  const [{ data: matchData }, { data: partData }] = await Promise.all([
    supabase
      .from("matches")
      .select("session_id, player1_id, player2_id, result")
      .in("session_id", sessionIds)
      .neq("result", "pending"),
    supabase
      .from("session_participants")
      .select("session_id, player_id, archetype1, archetype2")
      .in("session_id", sessionIds)
      .eq("archetype_public", true)
      .or("archetype1.not.is.null,archetype2.not.is.null"),
  ]);

  const archByParticipant = new Map<string, string[]>();
  for (const p of (partData as ParticipantRow[] | null) ?? []) {
    const keys = [p.archetype1, p.archetype2].filter(
      (k): k is string => !!k,
    );
    if (keys.length > 0) {
      archByParticipant.set(`${p.session_id}:${p.player_id}`, keys);
    }
  }

  type Agg = {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    players: Set<string>;
  };
  const agg = new Map<string, Agg>();
  const ensure = (key: string) => {
    let a = agg.get(key);
    if (!a) {
      a = { games: 0, wins: 0, draws: 0, losses: 0, players: new Set() };
      agg.set(key, a);
    }
    return a;
  };

  const credit = (
    sessionId: string,
    playerId: string,
    outcome: "win" | "draw" | "loss",
  ) => {
    const keys = archByParticipant.get(`${sessionId}:${playerId}`);
    if (!keys) return;
    for (const key of keys) {
      const a = ensure(key);
      a.games += 1;
      a.players.add(playerId);
      if (outcome === "win") a.wins += 1;
      else if (outcome === "draw") a.draws += 1;
      else a.losses += 1;
    }
  };

  for (const m of (matchData as MatchRow[] | null) ?? []) {
    if (m.result === "loss") {
      credit(m.session_id, m.player1_id, "loss");
      continue;
    }
    if (m.result === "bye" || m.player2_id === null) {
      credit(m.session_id, m.player1_id, "win");
      continue;
    }
    if (m.result === "p1_win") {
      credit(m.session_id, m.player1_id, "win");
      credit(m.session_id, m.player2_id, "loss");
    } else if (m.result === "p2_win") {
      credit(m.session_id, m.player2_id, "win");
      credit(m.session_id, m.player1_id, "loss");
    } else if (m.result === "draw") {
      credit(m.session_id, m.player1_id, "draw");
      credit(m.session_id, m.player2_id, "draw");
    }
  }

  const chips = await resolveArchetypes([...agg.keys()]);

  const rows: ArchetypeStatRow[] = [...agg.entries()].map(([key, a]) => ({
    key,
    chip: chips.get(key) ?? null,
    games: a.games,
    wins: a.wins,
    draws: a.draws,
    losses: a.losses,
    winRate: a.games > 0 ? a.wins / a.games : 0,
    players: a.players.size,
  }));

  rows.sort(
    (a, b) =>
      b.games - a.games ||
      b.winRate - a.winRate ||
      (a.chip?.name ?? a.key).localeCompare(b.chip?.name ?? b.key),
  );
  return rows;
}
