"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const game = String(formData.get("game") ?? "");
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = String(formData.get("location") ?? "");
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const description = String(formData.get("description") ?? "");
  const externalUrl = String(formData.get("external_url") ?? "");
  const prizes = String(formData.get("prizes") ?? "");
  const listRequired = String(formData.get("list_required") ?? "") === "true";

  if (!name) return { error: "Introduce un nombre." };
  if (game !== "tcg" && game !== "vgc") return { error: "Elige un juego." };
  const cost = costRaw === "" ? 0 : Number(costRaw);
  if (Number.isNaN(cost) || cost < 0) return { error: "Coste no válido." };
  const capacity = capacityRaw === "" ? null : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "El aforo debe ser un entero positivo." };
  }

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_event", {
    p_name: name,
    p_game: game,
    p_starts_at: startsAtIso === "" ? null : startsAtIso,
    p_location: location,
    p_cost: cost,
    p_description: description,
    p_external_url: externalUrl,
    p_prizes: prizes,
    p_list_required: listRequired,
    p_capacity: capacity,
  });
  if (error) return { error: error.message };

  revalidatePath("/events");
  redirect(`/events/${slug}`);
}

export async function registerEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const content = String(formData.get("content") ?? "");
  const url = String(formData.get("url") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_event", {
    p_event: eventId,
    p_content: content,
    p_url: url,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

export async function submitListAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const content = String(formData.get("content") ?? "");
  const url = String(formData.get("url") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_event_list", {
    p_event: eventId,
    p_content: content,
    p_url: url,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

export async function unregisterEventAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("unregister_event", { p_event: eventId });
  revalidatePath(`/events/${slug}`);
}

export async function adminRemoveRegistrationAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("admin_remove_registration", {
    p_event: eventId,
    p_player: playerId,
  });
  revalidatePath(`/events/${slug}`);
}

export async function setEventStatusAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const supabase = await createClient();
  await supabase.rpc("set_event_status", {
    p_event: eventId,
    p_status: status,
  });
  revalidatePath(`/events/${slug}`);
}
