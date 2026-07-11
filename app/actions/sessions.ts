"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const leagueId = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "");
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = String(formData.get("location") ?? "");
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const capacityRaw = String(formData.get("capacity") ?? "");

  const cost = costRaw === "" ? 0 : Number(costRaw);
  if (Number.isNaN(cost) || cost < 0) return { error: "Coste no válido." };
  const capacity = capacityRaw === "" ? null : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "El aforo debe ser un entero positivo." };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_session", {
    p_league: leagueId,
    p_name: name,
    p_starts_at: startsAtIso === "" ? null : startsAtIso,
    p_location: location,
    p_cost: cost,
    p_capacity: capacity,
  });
  if (error) return { error: error.message };

  revalidatePath(`/leagues/${slug}`);
  redirect(`/sessions/${id}`);
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  await supabase.rpc(fn, args);
}

export async function joinSessionAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  await rpc("join_session", { p_session: id });
  revalidatePath(`/sessions/${id}`);
}

export async function leaveSessionAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  await rpc("leave_session", { p_session: id });
  revalidatePath(`/sessions/${id}`);
}

export async function setMyArchetypesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("session_id") ?? "");
  const a1 = String(formData.get("a1") ?? "");
  const a2 = String(formData.get("a2") ?? "");
  const isPublic = String(formData.get("is_public") ?? "true") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_participant_archetypes", {
    p_session: id,
    p_a1: a1,
    p_a2: a2,
    p_public: isPublic,
  });
  if (error) return { error: error.message };
  revalidatePath(`/sessions/${id}`);
  return { ok: true };
}

export async function createSessionPlayerAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await rpc("create_session_player", { p_session: id, p_name: name });
  revalidatePath(`/sessions/${id}`);
}

export async function adminAddParticipantAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const player = String(formData.get("player_id") ?? "");
  if (!player) return;
  await rpc("admin_add_participant", { p_session: id, p_player: player });
  revalidatePath(`/sessions/${id}`);
}

export async function adminRemoveParticipantAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const player = String(formData.get("player_id") ?? "");
  await rpc("admin_remove_participant", { p_session: id, p_player: player });
  revalidatePath(`/sessions/${id}`);
}

export async function setSessionStatusAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const status = String(formData.get("status") ?? "");
  await rpc("set_session_status", { p_session: id, p_status: status });
  revalidatePath(`/sessions/${id}`);
}
