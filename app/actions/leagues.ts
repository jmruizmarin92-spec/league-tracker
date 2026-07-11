"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { capText, toMonthDate } from "@/lib/validation";
import { FORMATS_BY_GAME, type Game } from "@/lib/league-format";

export type ActionState = { error?: string; ok?: boolean };

export async function createLeagueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = capText(String(formData.get("name") ?? ""), 80);
  const game = String(formData.get("game") ?? "");
  const format = String(formData.get("format") ?? "");
  const description = capText(String(formData.get("description") ?? ""), 200);
  const startsMonth = toMonthDate(String(formData.get("starts_month") ?? ""));
  const endsMonth = toMonthDate(String(formData.get("ends_month") ?? ""));
  if (!name) return { error: "Introduce un nombre." };
  if (game !== "tcg" && game !== "vgc") return { error: "Elige un juego." };
  const allowed = FORMATS_BY_GAME[game as Game].map((f) => f.value);
  if (!allowed.includes(format)) return { error: "Elige un formato válido." };
  if (startsMonth && endsMonth && endsMonth < startsMonth) {
    return { error: "El mes de fin no puede ser anterior al de inicio." };
  }

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_game: game,
    p_description: description,
    p_starts_month: startsMonth,
    p_ends_month: endsMonth,
    p_format: format,
  });
  if (error) return { error: error.message };

  revalidatePath("/leagues");
  redirect(`/leagues/${slug}`);
}

export async function updateLeagueDurationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const startsMonth = toMonthDate(String(formData.get("starts_month") ?? ""));
  const endsMonth = toMonthDate(String(formData.get("ends_month") ?? ""));
  if (startsMonth && endsMonth && endsMonth < startsMonth) {
    return { error: "El mes de fin no puede ser anterior al de inicio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leagues")
    .update({ starts_month: startsMonth, ends_month: endsMonth })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/leagues/${slug}/admin`);
  revalidatePath(`/leagues/${slug}`);
  revalidatePath("/leagues");
  return { ok: true };
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

// --- League locations (venue picklist + default) ---

async function getLeagueLocations(
  id: string,
): Promise<{ locations: string[]; default_location: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .select("locations, default_location")
    .eq("id", id)
    .maybeSingle();
  return data as { locations: string[]; default_location: string | null } | null;
}

export async function setLeagueArchivedAction(formData: FormData) {
  const id = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("leagues")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/", "layout");
  revalidatePath(`/leagues/${slug}/admin`);
  revalidatePath(`/leagues/${slug}`);
}

export async function addLeagueLocationAction(formData: FormData) {
  const id = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const location = capText(String(formData.get("location") ?? ""), 120);
  if (!id || !location) return;

  const current = await getLeagueLocations(id);
  if (!current) return;
  if (current.locations.includes(location)) return;

  const locations = [...current.locations, location];
  const supabase = await createClient();
  await supabase
    .from("leagues")
    .update({
      locations,
      // First venue added becomes the default automatically.
      default_location: current.default_location ?? location,
    })
    .eq("id", id);
  revalidatePath(`/leagues/${slug}/admin`);
}

export async function removeLeagueLocationAction(formData: FormData) {
  const id = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const location = String(formData.get("location") ?? "");
  if (!id || !location) return;

  const current = await getLeagueLocations(id);
  if (!current) return;

  const locations = current.locations.filter((l) => l !== location);
  const supabase = await createClient();
  await supabase
    .from("leagues")
    .update({
      locations,
      default_location:
        current.default_location === location
          ? (locations[0] ?? null)
          : current.default_location,
    })
    .eq("id", id);
  revalidatePath(`/leagues/${slug}/admin`);
}

export async function setDefaultLocationAction(formData: FormData) {
  const id = String(formData.get("league_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const location = String(formData.get("location") ?? "");
  if (!id || !location) return;
  const supabase = await createClient();
  await supabase
    .from("leagues")
    .update({ default_location: location })
    .eq("id", id);
  revalidatePath(`/leagues/${slug}/admin`);
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

export async function deleteLeagueAction(formData: FormData) {
  const id = String(formData.get("league_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_league", { p_league: id });
  if (error) return;
  revalidatePath("/", "layout");
  redirect("/leagues");
}
