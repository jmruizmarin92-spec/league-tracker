import { createClient } from "@/lib/supabase/server";
import type { PrizeKind } from "@/lib/event-prizes";

// Readers for the prize budget tables (0052, PL-29). Both are admin-only by
// RLS, so a non-admin simply gets null back — the page never renders the
// card for them anyway.

export type StorePrizeDefaults = {
  venue_fee: number;
  judge_fee: number;
  entry_pack: boolean;
  pack_value: number;
};

export type EventPrizeBudget = StorePrizeDefaults & {
  extra_costs: number;
  extra_costs_note: string | null;
  prize_kind: PrizeKind;
  top_cut: number;
  shares: number[];
};

export async function getStorePrizeDefaults(
  storeId: string,
): Promise<StorePrizeDefaults | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_prize_defaults")
    .select("venue_fee, judge_fee, entry_pack, pack_value")
    .eq("store_id", storeId)
    .maybeSingle();
  return (data as StorePrizeDefaults | null) ?? null;
}

export async function getEventPrizeBudget(
  eventId: string,
): Promise<EventPrizeBudget | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_prize_budgets")
    .select(
      "venue_fee, judge_fee, entry_pack, pack_value, extra_costs, extra_costs_note, prize_kind, top_cut, shares",
    )
    .eq("event_id", eventId)
    .maybeSingle();
  return (data as EventPrizeBudget | null) ?? null;
}

// Players the last .tdf import brought in — the count the budget is built
// on. Zero until the TO imports TOM's file.
export async function countTdfPlayers(eventId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("event_tdf_players")
    .select("tdf_userid", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
