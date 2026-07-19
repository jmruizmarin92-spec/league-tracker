import { createClient } from "@/lib/supabase/server";
import { resolveArchetypes, type ArchetypeChip } from "@/lib/archetypes";
import type { Game } from "@/lib/leagues";

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

// Usage-only stats for events — events have no matches/results, so there's
// no win/loss record, just how many (and what share of) registered players
// declared this archetype.
export type EventArchetypeStatRow = {
  key: string;
  chip: ArchetypeChip | null;
  players: number;
  percentage: number; // players / field size, 0..1
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

// Per-archetype usage + win/loss/draw across a fixed set of sessions. Only
// public picks count; a match credits every archetype slot the player
// declared for that session (a two-archetype pick counts toward both).
async function computeArchetypeStatsForSessions(
  sessionIds: string[],
): Promise<ArchetypeStatRow[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createClient();

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
  return computeArchetypeStatsForSessions(sessionIds);
}

// Same as computeLeagueArchetypeStats but across every league of a given
// game, for the site-wide archetype stats page.
export async function computeGameLeagueArchetypeStats(
  game: Game,
): Promise<ArchetypeStatRow[]> {
  const supabase = await createClient();
  const { data: leagueRows } = await supabase
    .from("leagues")
    .select("id")
    .eq("game", game);
  const leagueIds = ((leagueRows as { id: string }[] | null) ?? []).map(
    (l) => l.id,
  );
  if (leagueIds.length === 0) return [];

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id")
    .in("league_id", leagueIds);
  const sessionIds = ((sessionRows as { id: string }[] | null) ?? []).map(
    (s) => s.id,
  );
  return computeArchetypeStatsForSessions(sessionIds);
}

type EventRegRow = {
  player_id: string;
  archetype1: string | null;
  archetype2: string | null;
};

// Usage stats for a fixed set of events. Events don't run matches on-site,
// so there's no win/loss record — just how many distinct players publicly
// declared each archetype, out of the registered field.
async function computeArchetypeStatsForEvents(
  eventIds: string[],
): Promise<EventArchetypeStatRow[]> {
  if (eventIds.length === 0) return [];
  const supabase = await createClient();

  const { data: regData } = await supabase
    .from("event_registrations")
    .select("player_id, archetype1, archetype2")
    .in("event_id", eventIds)
    .eq("status", "registered")
    .eq("archetype_public", true)
    .or("archetype1.not.is.null,archetype2.not.is.null");

  const regs = (regData as EventRegRow[] | null) ?? [];
  const fieldSize = new Set(regs.map((r) => r.player_id)).size;

  const playersByKey = new Map<string, Set<string>>();
  for (const r of regs) {
    for (const key of [r.archetype1, r.archetype2].filter(
      (k): k is string => !!k,
    )) {
      let set = playersByKey.get(key);
      if (!set) {
        set = new Set();
        playersByKey.set(key, set);
      }
      set.add(r.player_id);
    }
  }

  const chips = await resolveArchetypes([...playersByKey.keys()]);

  const rows: EventArchetypeStatRow[] = [...playersByKey.entries()].map(
    ([key, players]) => ({
      key,
      chip: chips.get(key) ?? null,
      players: players.size,
      percentage: fieldSize > 0 ? players.size / fieldSize : 0,
    }),
  );

  rows.sort(
    (a, b) =>
      b.players - a.players ||
      (a.chip?.name ?? a.key).localeCompare(b.chip?.name ?? b.key),
  );
  return rows;
}

export async function computeEventArchetypeStats(
  eventId: string,
): Promise<EventArchetypeStatRow[]> {
  return computeArchetypeStatsForEvents([eventId]);
}

// Same as computeEventArchetypeStats but across every event of a given game,
// for the site-wide archetype stats page.
export async function computeGameEventArchetypeStats(
  game: Game,
): Promise<EventArchetypeStatRow[]> {
  const supabase = await createClient();
  const { data: eventRows } = await supabase
    .from("events")
    .select("id")
    .eq("game", game);
  const eventIds = ((eventRows as { id: string }[] | null) ?? []).map(
    (e) => e.id,
  );
  return computeArchetypeStatsForEvents(eventIds);
}
