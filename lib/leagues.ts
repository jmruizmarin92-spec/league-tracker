import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/auth";
import type { MatchInput, MatchResult } from "@/lib/scoring";
import type { Game } from "@/lib/league-format";

export type { Game } from "@/lib/league-format";
export { FORMATS_BY_GAME, formatLabel } from "@/lib/league-format";

export type League = {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  game: Game;
  format: string | null;
  prizes: string | null;
  win_value: number;
  attendance_value: number;
  draw_value: number;
  locations: string[];
  default_location: string | null;
  session_weekday: number | null;
  session_time: string | null;
  default_cost: number;
  archived_at: string | null;
  starts_month: string | null;
  ends_month: string | null;
  created_at: string;
};

export async function listLeagues(): Promise<League[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as League[] | null) ?? [];
}

export async function listActiveLeagues(): Promise<League[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  return (data as League[] | null) ?? [];
}

export const getLeagueBySlug = cache(async (slug: string): Promise<League | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data as League | null;
});

export type LeagueAdmin = {
  user_id: string;
  role: "owner" | "admin";
  display_name: string;
  avatar_url: string | null;
};

export async function listLeagueAdmins(leagueId: string): Promise<LeagueAdmin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("league_members")
    .select("user_id, role")
    .eq("league_id", leagueId);

  const rows = (data as { user_id: string; role: "owner" | "admin" }[] | null) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((m) => m.user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  const profMap = new Map(
    ((profs as { id: string; display_name: string; avatar_url: string | null }[] | null) ?? []).map(
      (p) => [p.id, p],
    ),
  );

  return rows
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: profMap.get(m.user_id)?.display_name ?? "—",
      avatar_url: profMap.get(m.user_id)?.avatar_url ?? null,
    }))
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
}

// Is the current user an admin (owner/co-admin or site admin) of this league?
export async function isLeagueAdmin(leagueId: string): Promise<boolean> {
  const profile = await getProfile();
  if (profile?.is_admin) return true;
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

// Every match in a league, grouped by session (for league standings).
export async function getLeagueMatchesBySession(
  leagueId: string,
): Promise<MatchInput[][]> {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("league_id", leagueId);
  const sessionIds = ((sessions as { id: string }[] | null) ?? []).map(
    (s) => s.id,
  );
  if (sessionIds.length === 0) return [];

  const { data: matches } = await supabase
    .from("matches")
    .select("session_id, player1_id, player2_id, result")
    .in("session_id", sessionIds);

  const bySession = new Map<string, MatchInput[]>();
  for (const id of sessionIds) bySession.set(id, []);
  for (const m of (matches as
    | {
        session_id: string;
        player1_id: string;
        player2_id: string | null;
        result: MatchResult;
      }[]
    | null) ?? []) {
    bySession.get(m.session_id)?.push({
      player1: m.player1_id,
      player2: m.player2_id,
      result: m.result,
    });
  }
  return [...bySession.values()];
}

// Registered users not already admins of this league (for the add-admin picker).
export async function listAddableUsers(
  leagueId: string,
): Promise<{ id: string; display_name: string }[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  const existing = new Set(
    ((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id),
  );

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  return ((profs as { id: string; display_name: string }[] | null) ?? []).filter(
    (p) => !existing.has(p.id),
  );
}
