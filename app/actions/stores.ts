"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { capText } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean };

const PLAY_ID_RE = /^\d{1,20}$/;

function friendlyStoreError(message: string, playLeagueId: string): string {
  if (
    playLeagueId &&
    (/already has Play! league id/i.test(message) || /stores_play_league_id_key/.test(message))
  ) {
    return `Otra tienda ya tiene el ID de Play! Pokémon ${playLeagueId}.`;
  }
  return message;
}

// Everything the store admin page changes ripples into league and event
// headers, so revalidate broadly rather than tracking every page.
function revalidateStores() {
  revalidatePath("/admin/stores");
  revalidatePath("/leagues", "layout");
  revalidatePath("/events", "layout");
}

export async function createStoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const name = capText(String(formData.get("name") ?? ""), 80);
  const playLeagueId = String(formData.get("play_league_id") ?? "").trim();
  if (!name) return { error: "Introduce un nombre." };
  if (playLeagueId && !PLAY_ID_RE.test(playLeagueId)) {
    return { error: "El ID de liga de Play! Pokémon debe ser un número." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_store", {
    p_name: name,
    p_play_league_id: playLeagueId || null,
  });
  if (error) return { error: friendlyStoreError(error.message, playLeagueId) };
  revalidateStores();
  return { ok: true };
}

export async function updateStoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("store_id") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 80);
  const playLeagueId = String(formData.get("play_league_id") ?? "").trim();
  if (!id) return { error: "Tienda no válida." };
  if (!name) return { error: "Introduce un nombre." };
  if (playLeagueId && !PLAY_ID_RE.test(playLeagueId)) {
    return { error: "El ID de liga de Play! Pokémon debe ser un número." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ name, play_league_id: playLeagueId || null })
    .eq("id", id);
  if (error) return { error: friendlyStoreError(error.message, playLeagueId) };
  revalidateStores();
  return { ok: true };
}

// Leagues and events keep their rows (FKs are `on delete set null`); they
// just stop pointing at a store.
export async function deleteStoreAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("store_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("stores").delete().eq("id", id);
  revalidateStores();
}
