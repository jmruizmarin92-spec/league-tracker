import { createClient } from "@/lib/supabase/server";
import type { MatchResult } from "@/lib/scoring";

export type DbRound = { id: string; number: number; status: string };

export type DbMatch = {
  id: string;
  round_id: string;
  session_id: string;
  player1_id: string;
  player2_id: string | null;
  result: MatchResult;
};

export async function getRounds(sessionId: string): Promise<DbRound[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rounds")
    .select("id, number, status")
    .eq("session_id", sessionId)
    .order("number");
  return (data as DbRound[] | null) ?? [];
}

export async function getSessionMatches(sessionId: string): Promise<DbMatch[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("id, round_id, session_id, player1_id, player2_id, result")
    .eq("session_id", sessionId);
  return (data as DbMatch[] | null) ?? [];
}

// Active roster for pairing: registered participants who haven't dropped.
export async function getActiveParticipantIds(
  sessionId: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_participants")
    .select("player_id")
    .eq("session_id", sessionId)
    .eq("status", "registered")
    .is("dropped_round", null);
  return ((data as { player_id: string }[] | null) ?? []).map((r) => r.player_id);
}
