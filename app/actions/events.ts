"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { capText, isHttpUrl } from "@/lib/validation";
import { isCategory } from "@/lib/event-category";
import { getEventBySlug, isEventAdmin } from "@/lib/events";
import {
  GUEST_COOKIE_MAX_AGE_SECONDS,
  guestCookieName,
  guestCookiePath,
  isGuestToken,
  isValidPokemonId,
  normalizePokemonId,
} from "@/lib/event-guest";
import {
  isEventEntryLocked,
  DEFAULT_LIST_LOCK_MINUTES,
  MAX_LIST_LOCK_MINUTES,
} from "@/lib/event-deadline";

export type ActionState = { error?: string; ok?: boolean };

const LIST_CONTENT_MAX = 20_000;

// Minutes-before-start cutoff coming from the create/edit forms. Empty means
// "leave the default" on create, so it resolves to null for the RPC to fill in.
function parseLockMinutes(raw: string): number | null | "invalid" {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_LIST_LOCK_MINUTES) return "invalid";
  return n;
}

// Shared gate for the player-facing register/list actions: returns an error
// message once the cutoff has passed, unless the caller runs the event. The
// RPCs enforce this too (0039) — this is here to give a readable message.
async function entryDeadlineError(slug: string): Promise<string | null> {
  const event = await getEventBySlug(slug);
  if (!event || !isEventEntryLocked(event)) return null;
  if (await isEventAdmin(event.id)) return null;
  return "El plazo para inscribirse y enviar listas ya está cerrado.";
}

export async function createEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = capText(String(formData.get("name") ?? ""), 100);
  const subtitle = capText(String(formData.get("subtitle") ?? ""), 80);
  const category = String(formData.get("category") ?? "");
  const game = String(formData.get("game") ?? "");
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = capText(String(formData.get("location") ?? ""), 120);
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const description = capText(String(formData.get("description") ?? ""), 1000);
  const externalUrl = capText(String(formData.get("external_url") ?? ""), 500);
  const prizes = capText(String(formData.get("prizes") ?? ""), 1000);
  const listRequired = String(formData.get("list_required") ?? "") === "true";
  const allowGuests = String(formData.get("allow_guest_lists") ?? "") === "true";
  const lockMinutes = parseLockMinutes(String(formData.get("list_lock_minutes") ?? ""));
  const storeId = String(formData.get("store_id") ?? "").trim();
  const leagueId = String(formData.get("league_id") ?? "").trim();
  const tournamentId = parseTournamentId(String(formData.get("tournament_id") ?? ""));
  const status = String(formData.get("status") ?? "open");

  if (!name) return { error: "Introduce un nombre." };
  if (game !== "tcg" && game !== "vgc") return { error: "Elige un juego." };
  if (lockMinutes === "invalid") {
    return { error: "El cierre de listas debe ser un número de minutos válido." };
  }
  if (category && !isCategory(category)) return { error: "Categoría no válida." };
  if (externalUrl && !isHttpUrl(externalUrl)) {
    return { error: "El enlace externo no es una URL válida." };
  }
  if (tournamentId === "invalid") return { error: "El Tournament ID no es válido." };
  if (status !== "open" && status !== "closed" && status !== "complete") {
    return { error: "Estado no válido." };
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
    p_category: category || null,
    p_subtitle: subtitle || null,
    p_list_lock_minutes: lockMinutes,
    p_league_id: leagueId || null,
    p_tournament_id: tournamentId,
    p_status: status,
    p_store_id: storeId || null,
    p_allow_guest_lists: allowGuests,
  });
  if (error) return { error: friendlyEventError(error.message, tournamentId) };

  revalidatePath("/");
  if (leagueId) revalidatePath("/leagues", "layout");
  redirect(`/events/${slug}`);
}

// TOM tournament ids look like 26-08-001970; we only insist on something
// short and printable so a hand-typed one from another region still fits.
function parseTournamentId(raw: string): string | null | "invalid" {
  const v = raw.trim();
  if (v === "") return null;
  if (v.length > 40 || !/^[\w.-]+$/.test(v)) return "invalid";
  return v;
}

// The RPC raises on a duplicate tournament id and the unique index does too
// on a direct update; both come back as raw SQL text, so translate them.
function friendlyEventError(message: string, tournamentId: string | null): string {
  if (
    tournamentId &&
    (/already exists/i.test(message) || /events_tournament_id_key/.test(message))
  ) {
    return `Ya existe un evento con el Tournament ID ${tournamentId}.`;
  }
  return message;
}

export async function updateEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 100);
  const subtitle = capText(String(formData.get("subtitle") ?? ""), 80);
  const category = String(formData.get("category") ?? "");
  const startsAtIso = String(formData.get("starts_at_iso") ?? "");
  const location = capText(String(formData.get("location") ?? ""), 120);
  const costRaw = String(formData.get("cost") ?? "0").replace(",", ".");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const description = capText(String(formData.get("description") ?? ""), 1000);
  const externalUrl = capText(String(formData.get("external_url") ?? ""), 500);
  const prizes = capText(String(formData.get("prizes") ?? ""), 1000);
  const listRequired = String(formData.get("list_required") ?? "") === "true";
  const allowGuests = String(formData.get("allow_guest_lists") ?? "") === "true";
  const lockMinutes = parseLockMinutes(String(formData.get("list_lock_minutes") ?? ""));
  const storeId = String(formData.get("store_id") ?? "").trim();
  const leagueId = String(formData.get("league_id") ?? "").trim();
  const tournamentId = parseTournamentId(String(formData.get("tournament_id") ?? ""));

  if (!name) return { error: "Introduce un nombre." };
  if (category && !isCategory(category)) return { error: "Categoría no válida." };
  if (lockMinutes === "invalid") {
    return { error: "El cierre de listas debe ser un número de minutos válido." };
  }
  if (externalUrl && !isHttpUrl(externalUrl)) {
    return { error: "El enlace externo no es una URL válida." };
  }
  if (tournamentId === "invalid") return { error: "El Tournament ID no es válido." };
  const cost = costRaw === "" ? 0 : Number(costRaw);
  if (Number.isNaN(cost) || cost < 0) return { error: "Coste no válido." };
  const capacity = capacityRaw === "" ? null : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: "El aforo debe ser un entero positivo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      name,
      subtitle: subtitle || null,
      category: category || null,
      starts_at: startsAtIso === "" ? null : startsAtIso,
      location: location || null,
      cost,
      description: description || null,
      external_url: externalUrl || null,
      prizes: prizes || null,
      list_required: listRequired,
      allow_guest_lists: allowGuests,
      list_lock_minutes: lockMinutes ?? DEFAULT_LIST_LOCK_MINUTES,
      capacity,
      store_id: storeId || null,
      league_id: leagueId || null,
      tournament_id: tournamentId,
    })
    .eq("id", eventId);
  if (error) return { error: friendlyEventError(error.message, tournamentId) };

  revalidatePath(`/events/${slug}`);
  revalidatePath("/");
  revalidatePath("/leagues", "layout");
  return { ok: true };
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
  const locked = await entryDeadlineError(slug);
  if (locked) return { error: locked };

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
  const locked = await entryDeadlineError(slug);
  if (locked) return { error: locked };

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

// ---------------------------------------------------------------------------
// Guest submissions (PL-19, 0048): no account, name + Pokémon ID + list. The
// RPC hands back an edit token that lives in an httpOnly cookie scoped to the
// event page (and is echoed to the client once, for the private link).
// ---------------------------------------------------------------------------

export type GuestActionState = ActionState & { token?: string };

// The RPCs raise in English; map the ones a guest can actually trigger.
function friendlyGuestError(message: string): string {
  if (message.includes("not enabled")) {
    return "Este evento no admite inscripciones sin cuenta.";
  }
  if (message.includes("Registration is closed")) return "La inscripción está cerrada.";
  if (message.includes("deadline has passed")) {
    return "El plazo para inscribirse y enviar listas ya está cerrado.";
  }
  if (message.includes("belongs to a registered user")) {
    return "Ese Player ID pertenece a alguien con cuenta. Inicia sesión para inscribirte.";
  }
  if (message.includes("already registered")) {
    return "Ya hay una inscripción con ese Player ID en este evento. Si es la tuya, abre tu enlace privado o habla con la organización.";
  }
  if (message.includes("Unknown guest entry")) {
    return "No encontramos tu inscripción. Puede que la organización la haya retirado.";
  }
  if (message.includes("A list is required")) return "Pega tu lista o su enlace.";
  return message;
}

function guestListError(content: string, url: string): string | null {
  if (url && !isHttpUrl(url)) return "El enlace no es una URL válida.";
  if (!content && !url) return "Pega tu lista o su enlace.";
  return null;
}

export async function guestSubmitListAction(
  _prev: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 100);
  const pokemonIdRaw = String(formData.get("pokemon_id") ?? "");
  const content = capText(String(formData.get("content") ?? ""), LIST_CONTENT_MAX);
  const url = capText(String(formData.get("url") ?? ""), 500);

  if (!name) return { error: "Introduce tu nombre y apellidos." };
  if (!isValidPokemonId(pokemonIdRaw)) {
    return { error: "El Player ID debe tener entre 1 y 10 dígitos." };
  }
  const listErr = guestListError(content, url);
  if (listErr) return { error: listErr };
  // Readable message before the RPC; the RPC enforces it too. Admins get no
  // bypass here on purpose — a logged-in admin is not a guest.
  const event = await getEventBySlug(slug);
  if (event && isEventEntryLocked(event)) {
    return { error: "El plazo para inscribirse y enviar listas ya está cerrado." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guest_submit_event_list", {
    p_event: eventId,
    p_name: name,
    p_pokemon_id: normalizePokemonId(pokemonIdRaw),
    p_content: content,
    p_url: url,
  });
  if (error) return { error: friendlyGuestError(error.message) };
  const token = typeof data === "string" ? data : "";
  if (!isGuestToken(token)) return { error: "No se pudo guardar la inscripción." };

  const cookieStore = await cookies();
  cookieStore.set(guestCookieName(eventId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: guestCookiePath(slug),
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  });
  revalidatePath(`/events/${slug}`);
  return { ok: true, token };
}

export async function guestUpdateListAction(
  _prev: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const token = String(formData.get("token") ?? "");
  const content = capText(String(formData.get("content") ?? ""), LIST_CONTENT_MAX);
  const url = capText(String(formData.get("url") ?? ""), 500);

  if (!isGuestToken(token)) {
    return { error: "No encontramos tu inscripción. Abre tu enlace privado." };
  }
  const listErr = guestListError(content, url);
  if (listErr) return { error: listErr };
  const event = await getEventBySlug(slug);
  if (event && isEventEntryLocked(event)) {
    return { error: "El plazo para inscribirse y enviar listas ya está cerrado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("guest_update_event_list", {
    p_event: eventId,
    p_token: token,
    p_content: content,
    p_url: url,
  });
  if (error) return { error: friendlyGuestError(error.message) };
  revalidatePath(`/events/${slug}`);
  return { ok: true, token };
}

// Admin: write a registrant's list on their behalf, cutoff or not.
export async function adminSubmitListAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  const content = capText(String(formData.get("content") ?? ""), LIST_CONTENT_MAX);
  const url = capText(String(formData.get("url") ?? ""), 500);
  if (url && !isHttpUrl(url)) return { error: "El enlace no es una URL válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_submit_event_list", {
    p_event: eventId,
    p_player: playerId,
    p_content: content,
    p_url: url,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

export async function setMyEventArchetypesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const a1 = String(formData.get("a1") ?? "");
  const a2 = String(formData.get("a2") ?? "");
  const isPublic = String(formData.get("is_public") ?? "true") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_archetypes", {
    p_event: eventId,
    p_a1: a1,
    p_a2: a2,
    p_public: isPublic,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

// Admin: set another registrant's archetype picks (e.g. a managed player, or
// correcting/entering one on someone's behalf).
export async function adminSetEventParticipantArchetypesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const player = String(formData.get("player_id") ?? "");
  const a1 = String(formData.get("a1") ?? "");
  const a2 = String(formData.get("a2") ?? "");
  const isPublic = String(formData.get("is_public") ?? "true") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_event_archetypes", {
    p_event: eventId,
    p_player: player,
    p_a1: a1,
    p_a2: a2,
    p_public: isPublic,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${slug}`);
  return { ok: true };
}

export async function setEventArchetypeVisibilityAction(
  eventId: string,
  slug: string,
  isPublic: boolean,
) {
  const supabase = await createClient();
  await supabase.rpc("set_event_archetype_visibility", {
    p_event: eventId,
    p_public: isPublic,
  });
  revalidatePath(`/events/${slug}`);
}

// On-site check-in toggle (0040). Bound with the slug on the page so the
// roster can call it as (eventId, playerId, checkedIn) like its session twin.
export async function adminSetEventCheckedInAction(
  slug: string,
  eventId: string,
  playerId: string,
  checkedIn: boolean,
) {
  const supabase = await createClient();
  await supabase.rpc("admin_set_event_checked_in", {
    p_event: eventId,
    p_player: playerId,
    p_checked_in: checkedIn,
  });
  revalidatePath(`/events/${slug}`);
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

export async function addEventStaffAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  const role = capText(String(formData.get("role") ?? ""), 60);
  if (!playerId || !role) return;
  const supabase = await createClient();
  await supabase.rpc("add_event_staff", {
    p_event: eventId,
    p_player: playerId,
    p_role: role,
  });
  revalidatePath(`/events/${slug}`);
}

export async function createEventStaffPlayerAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const name = capText(String(formData.get("name") ?? ""), 60);
  const role = capText(String(formData.get("role") ?? ""), 60);
  if (!name || !role) return;
  const supabase = await createClient();
  await supabase.rpc("create_event_staff_player", {
    p_event: eventId,
    p_name: name,
    p_role: role,
  });
  revalidatePath(`/events/${slug}`);
}

export async function removeEventStaffAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("remove_event_staff", {
    p_event: eventId,
    p_player: playerId,
  });
  revalidatePath(`/events/${slug}`);
}

export async function deleteEventAction(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_event", { p_event: eventId });
  if (error) return;
  revalidatePath("/");
  redirect("/");
}
