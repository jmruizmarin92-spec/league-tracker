import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/players";
import type { Game } from "@/lib/league-format";
import type { PlayerMatchRecord, LeaguePointConfig } from "@/lib/player-profile";
import { resolveArchetypes, type ArchetypeChip } from "@/lib/archetypes";

export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Player | null;
}

type MatchRow = {
  session_id: string;
  player1_id: string;
  player2_id: string | null;
  result: "pending" | "p1_win" | "p2_win" | "draw" | "bye";
  sessions: { league_id: string } | null;
};

// Every decided match this player was part of, as PlayerMatchRecord[].
export async function getPlayerMatchRecords(
  playerId: string,
): Promise<PlayerMatchRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("session_id, player1_id, player2_id, result, sessions(league_id)")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .neq("result", "pending");

  const rows = (data as MatchRow[] | null) ?? [];
  const records: PlayerMatchRecord[] = [];
  for (const m of rows) {
    const leagueId = m.sessions?.league_id;
    if (!leagueId) continue;
    const isP1 = m.player1_id === playerId;

    if (m.result === "bye") {
      records.push({
        sessionId: m.session_id,
        leagueId,
        opponentId: null,
        result: "win",
      });
      continue;
    }

    const opponentId = isP1 ? m.player2_id : m.player1_id;
    let result: "win" | "loss" | "draw";
    if (m.result === "draw") result = "draw";
    else if ((m.result === "p1_win") === isP1) result = "win";
    else result = "loss";

    records.push({ sessionId: m.session_id, leagueId, opponentId, result });
  }
  return records;
}

export type PlayerEventHistoryRow = {
  eventId: string;
  slug: string;
  name: string;
  game: Game | null;
  category: string | null;
  startsAt: string | null;
  wins: number;
  losses: number;
  draws: number;
  place: number | null; // official final placing, once TOM closed the event
};

type EventMatchHistoryRow = {
  event_id: string;
  player1_id: string;
  player2_id: string | null;
  official_result:
    | "pending"
    | "p1_win"
    | "p2_win"
    | "draw"
    | "double_loss"
    | "bye";
  events: {
    slug: string;
    name: string;
    game: Game;
    category: string | null;
    starts_at: string | null;
  } | null;
};

// This player's record at standalone events, built from the pairings imported
// from TOM plus the official final placing when the event was closed. Kept out
// of the league career totals on purpose: those numbers mean "league play",
// and quietly folding event results into them would change what the profile
// has always claimed.
export async function getPlayerEventHistory(
  playerId: string,
): Promise<PlayerEventHistoryRow[]> {
  const supabase = await createClient();
  const [{ data: matchData }, { data: placeData }] = await Promise.all([
    supabase
      .from("event_matches")
      .select(
        "event_id, player1_id, player2_id, official_result, events(slug, name, game, category, starts_at)",
      )
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .neq("official_result", "pending"),
    supabase
      .from("event_standings")
      .select("event_id, place")
      .eq("player_id", playerId),
  ]);

  const places = new Map(
    ((placeData as { event_id: string; place: number }[] | null) ?? []).map(
      (p) => [p.event_id, p.place],
    ),
  );

  const rows = new Map<string, PlayerEventHistoryRow>();
  for (const m of (matchData as EventMatchHistoryRow[] | null) ?? []) {
    const e = m.events;
    if (!e) continue;
    let row = rows.get(m.event_id);
    if (!row) {
      row = {
        eventId: m.event_id,
        slug: e.slug,
        name: e.name,
        game: e.game,
        category: e.category,
        startsAt: e.starts_at,
        wins: 0,
        losses: 0,
        draws: 0,
        place: places.get(m.event_id) ?? null,
      };
      rows.set(m.event_id, row);
    }

    // A bye counts as a win, matching how sessions score it.
    if (m.official_result === "bye" || m.player2_id === null) {
      row.wins += 1;
    } else if (m.official_result === "double_loss") {
      row.losses += 1;
    } else if (m.official_result === "draw") {
      row.draws += 1;
    } else {
      const isP1 = m.player1_id === playerId;
      if ((m.official_result === "p1_win") === isP1) row.wins += 1;
      else row.losses += 1;
    }
  }

  // An event can have a placing with no imported pairings only if the rounds
  // were cleared afterwards; nothing to show there, so placings alone don't
  // create a row.
  return [...rows.values()].sort((a, b) =>
    (b.startsAt ?? "").localeCompare(a.startsAt ?? ""),
  );
}

export async function getLeagueConfigs(
  leagueIds: string[],
): Promise<Map<string, LeaguePointConfig & { name: string; slug: string; game: Game }>> {
  const map = new Map<
    string,
    LeaguePointConfig & { name: string; slug: string; game: Game }
  >();
  if (leagueIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .select("id, name, slug, game, win_value, draw_value, attendance_value")
    .in("id", leagueIds);
  for (const l of (data as
    | {
        id: string;
        name: string;
        slug: string;
        game: Game;
        win_value: number;
        draw_value: number;
        attendance_value: number;
      }[]
    | null) ?? []) {
    map.set(l.id, {
      name: l.name,
      slug: l.slug,
      game: l.game,
      winValue: l.win_value,
      drawValue: l.draw_value,
      attendanceValue: l.attendance_value,
    });
  }
  return map;
}

export type ArchetypeHistoryEntry = {
  sessionId: string;
  sessionSlug: string;
  leagueName: string;
  leagueSlug: string;
  game: Game | null;
  startsAt: string | null;
  chips: ArchetypeChip[];
  isPublic: boolean;
};

// This player's archetype picks across sessions. `viewerCanSeePrivate` should
// be true only when the viewer is the player themself or a site admin.
export async function getArchetypeHistory(
  playerId: string,
  viewerCanSeePrivate: boolean,
): Promise<ArchetypeHistoryEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_participants")
    .select(
      "session_id, archetype1, archetype2, archetype_public, sessions(slug, starts_at, leagues(name, slug, game))",
    )
    .eq("player_id", playerId)
    .or("archetype1.not.is.null,archetype2.not.is.null");

  type Row = {
    session_id: string;
    archetype1: string | null;
    archetype2: string | null;
    archetype_public: boolean;
    sessions: {
      slug: string;
      starts_at: string | null;
      leagues: { name: string; slug: string; game: Game } | null;
    } | null;
  };
  const rows = ((data as Row[] | null) ?? []).filter(
    (r) => viewerCanSeePrivate || r.archetype_public,
  );

  const chips = await resolveArchetypes(
    rows.flatMap((r) => [r.archetype1, r.archetype2]),
  );

  return rows
    .map((r) => ({
      sessionId: r.session_id,
      sessionSlug: r.sessions?.slug ?? "",
      leagueName: r.sessions?.leagues?.name ?? "—",
      leagueSlug: r.sessions?.leagues?.slug ?? "",
      game: r.sessions?.leagues?.game ?? null,
      startsAt: r.sessions?.starts_at ?? null,
      isPublic: r.archetype_public,
      chips: [r.archetype1, r.archetype2]
        .filter((k): k is string => !!k)
        .map((k) => chips.get(k))
        .filter((c): c is ArchetypeChip => !!c),
    }))
    .sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));
}
