"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { capText, isHttpUrl } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean };

const LIST_CONTENT_MAX = 20_000;

export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = capText(String(formData.get("name") ?? ""), 100);
  const game = String(formData.get("game") ?? "");
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = capText(String(formData.get("location") ?? ""), 120);
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const description = capText(String(formData.get("description") ?? ""), 1000);
  const externalUrl = capText(String(formData.get("external_url") ?? ""), 500);
  const prizes = capText(String(formData.get("prizes") ?? ""), 1000);
  const listRequired = String(formData.get("list_required") ?? "") === "true";

  if (!name) return { error: "Introduce un nombre." };
  if (game !== "tcg" && game !== "vgc") return { error: "Elige un juego." };
  if (externalUrl && !isHttpUrl(externalUrl)) {
    return { error: "El enlace externo no es una URL válida." };
  }
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
  const content = capText(String(formData.get("content") ?? ""), LIST_CONTENT_MAX);
  const url = capText(String(formData.get("url") ?? ""), 500);
  if (url && !isHttpUrl(url)) return { error: "El enlace no es una URL válida." };

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
  const content = capText(String(formData.get("content") ?? ""), LIST_CONTENT_MAX);
  const url = capText(String(formData.get("url") ?? ""), 500);
  if (url && !isHttpUrl(url)) return { error: "El enlace no es una URL válida." };

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

export async function deleteEventAction(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_event", { p_event: eventId });
  if (error) return;
  revalidatePath("/events");
  revalidatePath("/", "layout");
  redirect("/events");
}
