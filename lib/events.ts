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
  capacity: number | null;
  status: EventStatus;
  created_at: string;
};

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

export async function isEventAdmin(eventId: string): Promise<boolean> {
  const profile = await getProfile();
  if (profile?.is_admin) return true;
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_admins")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

export type EventParticipant = {
  player_id: string;
  status: "registered" | "waitlisted";
  has_list: boolean;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
};

type RegRow = {
  player_id: string;
  status: "registered" | "waitlisted";
  has_list: boolean;
  registered_at: string;
  players: {
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export async function listRegistrations(
  eventId: string,
): Promise<EventParticipant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registrations")
    .select(
      "player_id, status, has_list, registered_at, players(display_name, first_name, last_name)",
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
  }));
}

export type MyRegistration = {
  status: "registered" | "waitlisted";
  has_list: boolean;
  content: string | null;
  url: string | null;
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
    .select("status, has_list")
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

  const r = reg as { status: "registered" | "waitlisted"; has_list: boolean };
  const l = list as { content: string | null; url: string | null } | null;
  return {
    status: r.status,
    has_list: r.has_list,
    content: l?.content ?? null,
    url: l?.url ?? null,
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
