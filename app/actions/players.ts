"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { capText, capTextOrNull } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean };

const NAME_MAX = 60;

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  return error ? error.message : null;
}

export async function updateMyPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const alias = capText(String(formData.get("display_name") ?? ""), NAME_MAX);
  if (!alias) return { error: "El alias es obligatorio." };

  const { error } = await supabase
    .from("players")
    .update({
      display_name: alias,
      first_name: capTextOrNull(String(formData.get("first_name") ?? ""), NAME_MAX),
      last_name: capTextOrNull(String(formData.get("last_name") ?? ""), NAME_MAX),
      pokemon_id: capTextOrNull(String(formData.get("pokemon_id") ?? ""), NAME_MAX),
      game_id: capTextOrNull(String(formData.get("game_id") ?? ""), NAME_MAX),
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createManagedPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = capText(String(formData.get("display_name") ?? ""), NAME_MAX);
  if (!name) return { error: "Introduce un nombre." };
  const err = await callRpc("create_managed_player", { p_display_name: name });
  if (err) return { error: err };
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function mergePlayersAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const from = String(formData.get("from") ?? "");
  const into = String(formData.get("into") ?? "");
  if (!from || !into) return { error: "Selecciona los dos jugadores." };
  if (from === into) return { error: "No puedes fusionar un jugador consigo mismo." };
  const err = await callRpc("merge_players", { p_from: from, p_into: into });
  if (err) return { error: err };
  revalidatePath("/admin/players");
  return { ok: true };
}

// Simple button actions (revalidate; errors surface via Next error handling).
export async function requestClaimAction(formData: FormData) {
  await callRpc("request_player_claim", {
    p_player_id: String(formData.get("player_id")),
  });
  revalidatePath("/", "layout");
}

export async function approveClaimAction(formData: FormData) {
  await callRpc("approve_player_claim", {
    p_claim_id: String(formData.get("claim_id")),
  });
  revalidatePath("/admin/players");
  revalidatePath("/", "layout");
}

export async function rejectClaimAction(formData: FormData) {
  await callRpc("reject_player_claim", {
    p_claim_id: String(formData.get("claim_id")),
  });
  revalidatePath("/admin/players");
}

export async function deletePlayerAction(formData: FormData) {
  const playerId = String(formData.get("player_id") ?? "");
  if (!playerId) return;
  await callRpc("delete_player", { p_player: playerId });
  revalidatePath("/admin/players");
}
