import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type { Game } from "@/lib/leagues";

export type SessionStatus = "setup" | "active" | "complete";

export type Session = {
  id: string;
  league_id: string;
  name: string | null;
  starts_at: string | null;
  location: string | null;
  cost: number;
  capacity: number | null;
  status: SessionStatus;
  created_at: string;
};

export type SessionWithLeague = Session & {
  league: { id: string; name: string; slug: string; game: Game } | null;
};

export async function listSessions(leagueId: string): Promise<Session[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("league_id", leagueId)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data as Session[] | null) ?? [];
}

export const getSession = cache(
  async (id: string): Promise<SessionWithLeague | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("sessions")
      .select("*, league:leagues(id, name, slug, game)")
      .eq("id", id)
      .maybeSingle();
    return data as SessionWithLeague | null;
  },
);

export type SessionParticipant = {
  player_id: string;
  status: "registered" | "waitlisted";
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  is_me: boolean;
};

type ParticipantRow = {
  player_id: string;
  status: "registered" | "waitlisted";
  created_at: string;
  players: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    user_id: string | null;
  } | null;
};

export async function listParticipants(
  sessionId: string,
): Promise<SessionParticipant[]> {
  const supabase = await createClient();
  const user = await getUser();
  const { data } = await supabase
    .from("session_participants")
    .select(
      "player_id, status, created_at, players(id, display_name, first_name, last_name, user_id)",
    )
    .eq("session_id", sessionId)
    .order("created_at");

  const rows = (data as ParticipantRow[] | null) ?? [];
  return rows.map((r) => ({
    player_id: r.player_id,
    status: r.status,
    display_name: r.players?.display_name ?? "—",
    first_name: r.players?.first_name ?? null,
    last_name: r.players?.last_name ?? null,
    is_me: !!user && r.players?.user_id === user.id,
  }));
}

// The current user's participation status in a session (or null).
export async function getMyParticipation(
  sessionId: string,
): Promise<"registered" | "waitlisted" | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player) return null;
  const { data } = await supabase
    .from("session_participants")
    .select("status")
    .eq("session_id", sessionId)
    .eq("player_id", (player as { id: string }).id)
    .maybeSingle();
  return (data as { status: "registered" | "waitlisted" } | null)?.status ?? null;
}
