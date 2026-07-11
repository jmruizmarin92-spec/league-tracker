import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/leagues";

export type UpcomingItem = {
  kind: "session" | "event";
  href: string;
  name: string;
  game: Game;
  category: string | null; // events only; sessions always null
  startsAt: string;
  location: string | null;
  cost: number;
  subtitle: string | null; // league name for sessions; the event's own subtitle for events
};

type SessionRow = {
  id: string;
  name: string | null;
  starts_at: string;
  location: string | null;
  cost: number;
  status: string;
  league: { name: string; slug: string; game: Game } | null;
};

type EventRow = {
  slug: string;
  name: string;
  starts_at: string;
  location: string | null;
  cost: number;
  game: Game;
  category: string | null;
  subtitle: string | null;
};

// Every upcoming session + independent event (future, not yet complete).
// Small-scale app — no pagination; filtering (by game/category) happens
// after this, so nothing here should be truncated.
export async function getUpcoming(): Promise<UpcomingItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, name, starts_at, location, cost, status, league:leagues(name, slug, game)",
      )
      .gte("starts_at", nowIso)
      .neq("status", "complete")
      .order("starts_at"),
    supabase
      .from("events")
      .select("slug, name, starts_at, location, cost, game, category, subtitle")
      .gte("starts_at", nowIso)
      .neq("status", "complete")
      .order("starts_at"),
  ]);

  const items: UpcomingItem[] = [];

  for (const s of (sessions as SessionRow[] | null) ?? []) {
    if (!s.starts_at || !s.league) continue;
    items.push({
      kind: "session",
      href: `/sessions/${s.id}`,
      name: s.name ?? s.league.name,
      game: s.league.game,
      category: null,
      startsAt: s.starts_at,
      location: s.location,
      cost: s.cost,
      subtitle: s.league.name,
    });
  }

  for (const e of (events as EventRow[] | null) ?? []) {
    if (!e.starts_at) continue;
    items.push({
      kind: "event",
      href: `/events/${e.slug}`,
      name: e.name,
      game: e.game,
      category: e.category,
      startsAt: e.starts_at,
      location: e.location,
      cost: e.cost,
      subtitle: e.subtitle,
    });
  }

  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return items;
}
