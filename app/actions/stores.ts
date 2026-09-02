"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { isStoreAdmin } from "@/lib/stores";
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

// Everything the store pages change ripples into league and event headers
// (and, for the roster, into who sees admin controls there), so revalidate
// broadly rather than tracking every page.
function revalidateStores(slug?: string) {
  revalidatePath("/admin/stores");
  if (slug) revalidatePath(`/stores/${slug}/admin`);
  revalidatePath("/leagues", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/", "layout");
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

// Store admins edit their own store (RLS since 0046); the check here only
// gives a readable message instead of a silent no-row update.
export async function updateStoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("store_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 80);
  const playLeagueId = String(formData.get("play_league_id") ?? "").trim();
  if (!id) return { error: "Tienda no válida." };
  if (!(await isStoreAdmin(id))) return { error: "No tienes permiso." };
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
  revalidateStores(slug || undefined);
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

// --- Roster (0046). The RPCs decide who may do what: owners add/remove
// admins, only site admins add/remove owners.

function friendlyRosterError(message: string): string {
  if (/Not allowed/i.test(message)) return "No tienes permiso para cambiar los administradores.";
  if (/Unknown user/i.test(message)) return "Usuario no válido.";
  return message;
}

export async function addStoreAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const storeId = String(formData.get("store_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "admin");
  const slug = String(formData.get("slug") ?? "");
  if (!storeId || !userId) return { error: "Elige un usuario." };
  if (role !== "owner" && role !== "admin") return { error: "Rol no válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_store_admin", {
    p_store: storeId,
    p_user: userId,
    p_role: role,
  });
  if (error) return { error: friendlyRosterError(error.message) };
  revalidateStores(slug || undefined);
  return { ok: true };
}

export async function removeStoreAdminAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("store_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!storeId || !userId) return;
  const supabase = await createClient();
  await supabase.rpc("remove_store_admin", { p_store: storeId, p_user: userId });
  revalidateStores(slug || undefined);
}
