import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/auth";

export type Game = "tcg" | "vgc";

export type League = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  game: Game;
  win_value: number;
  attendance_value: number;
  draw_value: number;
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
