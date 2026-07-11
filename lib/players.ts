import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

export type Player = {
  id: string;
  display_name: string; // Alias — the name shown in pairings
  first_name: string | null;
  last_name: string | null;
  pokemon_id: string | null;
  game_id: string | null;
  user_id: string | null;
  created_by: string | null;
  created_at: string;
};

// The caller's linked player, if any.
export const getMyPlayer = cache(async (): Promise<Player | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data as Player | null;
});

export async function listPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .order("display_name");
  return (data as Player[] | null) ?? [];
}

export async function listUnclaimedPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .is("user_id", null)
    .order("display_name");
  return (data as Player[] | null) ?? [];
}

// Minimal player fields for name rendering, keyed by id.
export async function getPlayersByIds(
  ids: string[],
): Promise<Map<string, Pick<Player, "display_name" | "first_name" | "last_name">>> {
  const map = new Map<string, Pick<Player, "display_name" | "first_name" | "last_name">>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("id, display_name, first_name, last_name")
    .in("id", ids);
  for (const p of (data as (Player & { id: string })[] | null) ?? []) {
    map.set(p.id, {
      display_name: p.display_name,
      first_name: p.first_name,
      last_name: p.last_name,
    });
  }
  return map;
}

export type ClaimStatus = "pending" | "approved" | "rejected";

export type MyClaim = {
  id: string;
  player_id: string;
  status: ClaimStatus;
  created_at: string;
  player_name: string | null;
};

type ClaimWithPlayerRow = {
  id: string;
  player_id: string;
  requested_by: string;
  status: ClaimStatus;
  created_at: string;
  players: { display_name: string } | null;
};

// Claims made by the current user.
export async function getMyClaims(): Promise<MyClaim[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("player_claims")
    .select("id, player_id, status, created_at, players(display_name)")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  const rows = (data as ClaimWithPlayerRow[] | null) ?? [];
  return rows.map((c) => ({
    id: c.id,
    player_id: c.player_id,
    status: c.status,
    created_at: c.created_at,
    player_name: c.players?.display_name ?? null,
  }));
}

export type PendingClaim = {
  id: string;
  player_id: string;
  created_at: string;
  player_name: string | null;
  requester_name: string;
  requester_avatar: string | null;
};

// All pending claims (admin view).
export async function listPendingClaims(): Promise<PendingClaim[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("player_claims")
    .select("id, player_id, requested_by, created_at, players(display_name)")
    .eq("status", "pending")
    .order("created_at");

  const rows = (data as ClaimWithPlayerRow[] | null) ?? [];
  const requesterIds = [...new Set(rows.map((c) => c.requested_by))];

  const profiles = new Map<string, { display_name: string; avatar_url: string | null }>();
  if (requesterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", requesterIds);
    for (const p of (profs as { id: string; display_name: string; avatar_url: string | null }[] | null) ?? []) {
      profiles.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  return rows.map((c) => ({
    id: c.id,
    player_id: c.player_id,
    created_at: c.created_at,
    player_name: c.players?.display_name ?? null,
    requester_name: profiles.get(c.requested_by)?.display_name ?? "—",
    requester_avatar: profiles.get(c.requested_by)?.avatar_url ?? null,
  }));
}
