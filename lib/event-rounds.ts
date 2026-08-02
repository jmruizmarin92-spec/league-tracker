import { createClient } from "@/lib/supabase/server";

// Read side of the TOM (.tdf) import — see docs/features/events.md. Rounds and
// pairings here are a mirror of the judge's laptop, not something the site
// generates: nothing in this file writes.

export type EventOfficialResult =
  | "pending"
  | "p1_win"
  | "p2_win"
  | "draw"
  | "double_loss"
  | "bye";

export type EventReportedResult = "p1_win" | "p2_win" | "draw" | null;

export type EventRoundRow = {
  id: string;
  division: number;
  number: number;
  is_finals: boolean;
};

export type EventMatchRow = {
  id: string;
  round_id: string;
  pair_key: string;
  table_number: number | null;
  player1_id: string;
  player2_id: string | null;
  official_result: EventOfficialResult;
  reported_result: EventReportedResult;
};

export async function getEventRounds(eventId: string): Promise<EventRoundRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_rounds")
    .select("id, division, number, is_finals")
    .eq("event_id", eventId)
    .order("division")
    .order("number");
  return (data as EventRoundRow[] | null) ?? [];
}

export type EventStandingRow = {
  player_id: string;
  division: number;
  place: number;
};

// TOM's own final placings. Empty until the TO exports a closed tournament.
export async function getEventStandings(
  eventId: string,
): Promise<EventStandingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_standings")
    .select("player_id, division, place")
    .eq("event_id", eventId)
    .order("division")
    .order("place");
  return (data as EventStandingRow[] | null) ?? [];
}

export async function getEventMatches(eventId: string): Promise<EventMatchRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_matches")
    .select(
      "id, round_id, pair_key, table_number, player1_id, player2_id, official_result, reported_result",
    )
    // Stable order: by table, byes (null table) last, then creation — the list
    // must not reshuffle under a player as results come in.
    .eq("event_id", eventId)
    .order("table_number", { nullsFirst: false })
    .order("created_at");
  return (data as EventMatchRow[] | null) ?? [];
}

// TDF userid (Pokémon ID) → player id, for this event.
export async function getEventTdfMapping(
  eventId: string,
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_tdf_players")
    .select("tdf_userid, player_id")
    .eq("event_id", eventId);
  const map = new Map<string, string>();
  for (const r of (data as { tdf_userid: string; player_id: string }[] | null) ?? []) {
    map.set(r.tdf_userid, r.player_id);
  }
  return map;
}

export type EventTdfImport = {
  tdf_id: string | null;
  file_name: string | null;
  players_count: number;
  rounds_count: number;
  matches_count: number;
  imported_at: string;
};

// Most recent upload (admin-only by RLS; returns null for everyone else).
export async function getLastTdfImport(
  eventId: string,
): Promise<EventTdfImport | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_tdf_imports")
    .select("tdf_id, file_name, players_count, rounds_count, matches_count, imported_at")
    .eq("event_id", eventId)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EventTdfImport | null) ?? null;
}
