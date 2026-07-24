"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { capText } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean };

// Session pages are keyed by league+session slug rather than the session id,
// so a plain revalidatePath needs the route pattern (any league/session)
// rather than a literal path built from the id these actions receive.
function revalidateSession() {
  revalidatePath("/leagues/[slug]/sessions/[sessionSlug]", "page");
}

export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const leagueId = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 80);
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = capText(String(formData.get("location") ?? ""), 120);
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

  const { data: created } = await supabase
    .from("sessions")
    .select("slug")
    .eq("id", id)
    .single();

  revalidatePath(`/leagues/${slug}`);
  redirect(`/leagues/${slug}/sessions/${created?.slug}`);
}

export async function updateSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("session_id") ?? "");
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = capText(String(formData.get("location") ?? ""), 120);
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const capacityRaw = String(formData.get("capacity") ?? "");

  const cost = costRaw === "" ? 0 : Number(costRaw);
  if (Number.isNaN(cost) || cost < 0) return { error: "Coste no válido." };
  const capacity = capacityRaw === "" ? null : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "El aforo debe ser un entero positivo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_session", {
    p_session: id,
    p_starts_at: startsAtIso === "" ? null : startsAtIso,
    p_location: location,
    p_cost: cost,
    p_capacity: capacity,
  });
  if (error) return { error: error.message };

  revalidateSession();
  return { ok: true };
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  await supabase.rpc(fn, args);
}

export async function joinSessionAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  await rpc("join_session", { p_session: id });
  revalidateSession();
}

export async function leaveSessionAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  await rpc("leave_session", { p_session: id });
  revalidateSession();
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
  revalidateSession();
  return { ok: true };
}

// Admin: set another participant's archetype picks (e.g. a managed player,
// or correcting/entering one on someone's behalf during a session).
export async function adminSetParticipantArchetypesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("session_id") ?? "");
  const player = String(formData.get("player_id") ?? "");
  const a1 = String(formData.get("a1") ?? "");
  const a2 = String(formData.get("a2") ?? "");
  const isPublic = String(formData.get("is_public") ?? "true") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_participant_archetypes", {
    p_session: id,
    p_player: player,
    p_a1: a1,
    p_a2: a2,
    p_public: isPublic,
  });
  if (error) return { error: error.message };
  revalidateSession();
  return { ok: true };
}

export async function setArchetypeVisibilityAction(
  sessionId: string,
  isPublic: boolean,
) {
  const supabase = await createClient();
  await supabase.rpc("set_archetype_visibility", {
    p_session: sessionId,
    p_public: isPublic,
  });
  revalidateSession();
}

export async function createSessionPlayerAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 60);
  if (!id || !name) return;
  await rpc("create_session_player", { p_session: id, p_name: name });
  revalidateSession();
}

export async function adminAddParticipantAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const player = String(formData.get("player_id") ?? "");
  if (!player) return;
  // Late-join options (only meaningful once rounds exist; the RPC ignores them
  // otherwise). Absent fields default to a penalty-free next-round entry.
  const missed = formData.get("missed") === "loss" ? "loss" : "none";
  const entryRaw = String(formData.get("entry") ?? "next");
  // 'current' fills an existing bye; 'bye' hands the late player a free win.
  const entry =
    entryRaw === "current" || entryRaw === "bye" ? entryRaw : "next";
  await rpc("admin_add_late_participant", {
    p_session: id,
    p_player: player,
    p_missed: missed,
    p_entry: entry,
  });
  revalidateSession();
}

export async function adminRemoveParticipantAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const player = String(formData.get("player_id") ?? "");
  await rpc("admin_remove_participant", { p_session: id, p_player: player });
  revalidateSession();
}

export async function adminSetCheckedInAction(
  sessionId: string,
  playerId: string,
  checkedIn: boolean,
) {
  await rpc("admin_set_checked_in", {
    p_session: sessionId,
    p_player: playerId,
    p_checked_in: checkedIn,
  });
  revalidateSession();
}

export async function setSessionStatusAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const status = String(formData.get("status") ?? "");
  await rpc("set_session_status", { p_session: id, p_status: status });
  revalidateSession();
}

export async function deleteSessionAction(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  const leagueSlug = String(formData.get("league_slug") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_session", { p_session: id });
  if (error) return;
  revalidatePath(`/leagues/${leagueSlug}`);
  redirect(`/leagues/${leagueSlug}`);
}
