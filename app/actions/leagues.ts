"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

export async function createLeagueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const game = String(formData.get("game") ?? "");
  const description = String(formData.get("description") ?? "");
  if (!name) return { error: "Introduce un nombre." };
  if (game !== "tcg" && game !== "vgc") return { error: "Elige un juego." };

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_game: game,
    p_description: description,
  });
  if (error) return { error: error.message };

  revalidatePath("/leagues");
  redirect(`/leagues/${slug}`);
}

export async function updateLeaguePointsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const win = Number(formData.get("win_value"));
  const attendance = Number(formData.get("attendance_value"));
  const draw = Number(formData.get("draw_value"));
  if ([win, attendance, draw].some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "Los valores deben ser enteros ≥ 0." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leagues")
    .update({
      win_value: win,
      attendance_value: attendance,
      draw_value: draw,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/leagues/${slug}/admin`);
  revalidatePath(`/leagues/${slug}`);
  return { ok: true };
}

export async function addLeagueAdminAction(formData: FormData) {
  const league = String(formData.get("league_id") ?? "");
  const user = String(formData.get("user_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!league || !user) return;
  const supabase = await createClient();
  await supabase.rpc("add_league_admin", { p_league: league, p_user: user });
  revalidatePath(`/leagues/${slug}/admin`);
}

export async function removeLeagueAdminAction(formData: FormData) {
  const league = String(formData.get("league_id") ?? "");
  const user = String(formData.get("user_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!league || !user) return;
  const supabase = await createClient();
  await supabase.rpc("remove_league_admin", { p_league: league, p_user: user });
  revalidatePath(`/leagues/${slug}/admin`);
}
