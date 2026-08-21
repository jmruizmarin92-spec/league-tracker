"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/app/actions/sessions";

// Saved decks (PL-3). Session/event submissions auto-save through their own
// RPCs; these two back the explicit add/delete on /me.

export async function saveDeckAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const game = String(formData.get("game") ?? "");
  const a1 = String(formData.get("a1") ?? "");
  const a2 = String(formData.get("a2") ?? "");
  if (!a1 && !a2) return { error: "Elige al menos un arquetipo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_player_deck", {
    p_game: game,
    p_a1: a1,
    p_a2: a2,
  });
  if (error) return { error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function deleteDeckAction(formData: FormData) {
  const id = String(formData.get("deck_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.rpc("delete_player_deck", { p_id: id });
  revalidatePath("/me");
}
