import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// A store/organiser as the Play! Pokémon site sees it: its "League ID" is
// permanent (WAR LOTUS STORE = 6236068) and every season league and every
// pasted event hangs off it (0045).
export type Store = {
  id: string;
  name: string;
  slug: string;
  play_league_id: string | null;
  created_at: string;
};

export async function listStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true });
  return (data as Store[] | null) ?? [];
}

export const getStoreById = cache(async (id: string): Promise<Store | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Store | null;
});
