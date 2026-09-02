import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/auth";
import type { Game } from "@/lib/leagues";

export type EventStatus = "open" | "closed" | "complete";

export type EventRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  subtitle: string | null;
  game: Game;
  starts_at: string | null;
  location: string | null;
  cost: number;
  description: string | null;
  external_url: string | null;
  prizes: string | null;
  list_required: boolean;
  list_lock_minutes: number;
  capacity: number | null;
  status: EventStatus;
  // Optional store (0045), season league (0044) and TOM's tournament id, all
  // set by the Play! Pokémon paste on /admin/events; editable afterwards.
  store_id: string | null;
  league_id: string | null;
  tournament_id: string | null;
  // Guests (no account) may hand in a list with name + Pokémon ID (0048).
  allow_guest_lists: boolean;
  created_at: string;
};

// Standalone events linked to a league, oldest first — the league page lists
// them under its sessions.
export async function listLeagueEvents(leagueId: string): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("league_id", leagueId)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  return (data as EventRow[] | null) ?? [];
}

export async function listEvents(): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data as EventRow[] | null) ?? [];
}

export const getEventBySlug = cache(async (slug: string): Promise<EventRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data as EventRow | null;
});

// Site admin, event_admins row, or (0046) admin of the event's store. Same
// SQL helper the RLS policies and RPCs use.
export async function isEventAdmin(eventId: string): Promise<boolean> {
  const profile = await getProfile();
  if (profile?.is_admin) return true;
  if (!(await getUser())) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_event_admin", { p_event: eventId });
  return data === true;
}

// Event staff whose player row is linked to the logged-in user (0049, PL-22).
// Buys read-only access to the roster and the submitted lists so judges can
// deck-check; admins are a separate, wider check (isEventAdmin).
export async function isEventStaff(eventId: string): Promise<boolean> {
  if (!(await getUser())) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_event_staff", { p_event: eventId });
  return data === true;
}

export type EventParticipant = {
  player_id: string;
  status: "registered" | "waitlisted";
  has_list: boolean;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  pokemon_id: string | null;
  // False for managed players (guest submissions, TDF-created, staff created
  // by hand) — the roster flags them so the TO knows who has no login.
  has_account: boolean;
  archetype1: string | null;
  archetype2: string | null;
  archetype_public: boolean;
  checked_in: boolean;
};

type RegRow = {
  player_id: string;
  status: "registered" | "waitlisted";
  has_list: boolean;
  registered_at: string;
  archetype1: string | null;
  archetype2: string | null;
  archetype_public: boolean;
  checked_in: boolean;
  players: {
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    pokemon_id: string | null;
    user_id: string | null;
  } | null;
};

export async function listRegistrations(
  eventId: string,
): Promise<EventParticipant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registrations")
    .select(
      "player_id, status, has_list, registered_at, archetype1, archetype2, archetype_public, checked_in, players(display_name, first_name, last_name, pokemon_id, user_id)",
    )
    .eq("event_id", eventId)
    .order("registered_at");
  return ((data as RegRow[] | null) ?? []).map((r) => ({
    player_id: r.player_id,
    status: r.status,
    has_list: r.has_list,
    display_name: r.players?.display_name ?? "—",
    first_name: r.players?.first_name ?? null,
    last_name: r.players?.last_name ?? null,
    pokemon_id: r.players?.pokemon_id ?? null,
    has_account: !!r.players?.user_id,
    archetype1: r.archetype1,
    archetype2: r.archetype2,
    archetype_public: r.archetype_public,
    checked_in: r.checked_in,
  }));
}

export type MyRegistration = {
  status: "registered" | "waitlisted";
  has_list: boolean;
  content: string | null;
  url: string | null;
  archetype1: string | null;
  archetype2: string | null;
  archetype_public: boolean;
} | null;

export async function getMyRegistration(eventId: string): Promise<MyRegistration> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player) return null;
  const pid = (player as { id: string }).id;

  const { data: reg } = await supabase
    .from("event_registrations")
    .select("status, has_list, archetype1, archetype2, archetype_public")
    .eq("event_id", eventId)
    .eq("player_id", pid)
    .maybeSingle();
  if (!reg) return null;

  const { data: list } = await supabase
    .from("event_lists")
    .select("content, url")
    .eq("event_id", eventId)
    .eq("player_id", pid)
    .maybeSingle();

  const r = reg as {
    status: "registered" | "waitlisted";
    has_list: boolean;
    archetype1: string | null;
    archetype2: string | null;
    archetype_public: boolean;
  };
  const l = list as { content: string | null; url: string | null } | null;
  return {
    status: r.status,
    has_list: r.has_list,
    content: l?.content ?? null,
    url: l?.url ?? null,
    archetype1: r.archetype1,
    archetype2: r.archetype2,
    archetype_public: r.archetype_public,
  };
}

export type EventStaffMember = {
  player_id: string;
  role: string;
  display_name: string;
};

type StaffRow = {
  player_id: string;
  role: string;
  players: { display_name: string } | null;
};

export async function listEventStaff(eventId: string): Promise<EventStaffMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_staff")
    .select("player_id, role, players(display_name)")
    .eq("event_id", eventId)
    .order("created_at");
  return ((data as StaffRow[] | null) ?? []).map((r) => ({
    player_id: r.player_id,
    role: r.role,
    display_name: r.players?.display_name ?? "—",
  }));
}

// Admin: all submitted lists for an event, keyed by player_id (RLS allows admins).
// A guest's own submission (0048), looked up by the edit token it received on
// submit. Null when the token is unknown for this event or the TO removed the
// registration since. The RPC is security definer: event_guest_entries has no
// grants, so this is the only read path.
export type GuestEntry = {
  player_id: string;
  display_name: string;
  pokemon_id: string | null;
  status: "registered" | "waitlisted";
  content: string | null;
  url: string | null;
};

export async function getGuestEntry(
  eventId: string,
  token: string,
): Promise<GuestEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("guest_get_event_entry", {
    p_event: eventId,
    p_token: token,
  });
  const rows = (data as GuestEntry[] | null) ?? [];
  return rows[0] ?? null;
}

export async function getEventLists(
  eventId: string,
): Promise<Map<string, { content: string | null; url: string | null }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_lists")
    .select("player_id, content, url")
    .eq("event_id", eventId);
  const map = new Map<string, { content: string | null; url: string | null }>();
  for (const l of (data as { player_id: string; content: string | null; url: string | null }[] | null) ?? []) {
    map.set(l.player_id, { content: l.content, url: l.url });
  }
  return map;
}
