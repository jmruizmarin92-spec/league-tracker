"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

export async function createCustomArchetypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const game = String(formData.get("game") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const iconUrl = String(formData.get("icon_url") ?? "").trim();
  if (game !== "tcg" && game !== "vgc") return { error: "Juego no válido." };
  if (!name) return { error: "Introduce un nombre." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("archetype_customs").insert({
    game,
    name,
    icon_url: iconUrl === "" ? null : iconUrl,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/arquetipos");
  return { ok: true };
}

export async function deleteCustomArchetypeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("archetype_customs").delete().eq("id", id);
  revalidatePath("/admin/arquetipos");
}

export async function toggleCustomArchetypeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("archetype_customs").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/arquetipos");
}
