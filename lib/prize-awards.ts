import { createClient } from "@/lib/supabase/server";

export type PrizeScope = "q1" | "q2" | "q3" | "q4" | "year";

export type PrizeAward = {
  scope: PrizeScope;
  winnerPlayerId: string | null;
  packs: number;
  awardedAt: string;
};

export async function getLeaguePrizeAwards(
  leagueId: string,
): Promise<Map<PrizeScope, PrizeAward>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("league_prize_awards")
    .select("scope, winner_player_id, packs, awarded_at")
    .eq("league_id", leagueId);

  const map = new Map<PrizeScope, PrizeAward>();
  for (const row of (data as
    | {
        scope: PrizeScope;
        winner_player_id: string | null;
        packs: number;
        awarded_at: string;
      }[]
    | null) ?? []) {
    map.set(row.scope, {
      scope: row.scope,
      winnerPlayerId: row.winner_player_id,
      packs: row.packs,
      awardedAt: row.awarded_at,
    });
  }
  return map;
}
