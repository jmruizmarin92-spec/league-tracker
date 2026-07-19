import { createClient } from "@/lib/supabase/server";
import { startOfTodayIso } from "@/lib/format";
import type { Game } from "@/lib/leagues";

export type UpcomingItem = {
  kind: "session" | "event";
  href: string;
  name: string;
  game: Game;
  format: string | null; // sessions only, inherited from the league; events always null
  category: string | null; // events only; sessions always null
  startsAt: string;
  location: string | null;
  cost: number;
  subtitle: string | null; // league name for sessions; the event's own subtitle for events
};

type SessionRow = {
  id: string;
  name: string | null;
  slug: string;
  starts_at: string;
  location: string | null;
  cost: number;
  status: string;
  league: { name: string; slug: string; game: Game; format: string | null } | null;
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

// Every upcoming session + independent event (today onward, not yet complete).
// The cutoff is the start of today (local time), so a session/event stays on
// the landing page for the whole day it runs instead of vanishing at its start
// time. Small-scale app — no pagination; filtering (by game/category) happens
// after this, so nothing here should be truncated.
export async function getUpcoming(): Promise<UpcomingItem[]> {
  const supabase = await createClient();
  const cutoffIso = startOfTodayIso();

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, name, slug, starts_at, location, cost, status, league:leagues(name, slug, game, format)",
      )
      .gte("starts_at", cutoffIso)
      .neq("status", "complete")
      .order("starts_at"),
    supabase
      .from("events")
      .select("slug, name, starts_at, location, cost, game, category, subtitle")
      .gte("starts_at", cutoffIso)
      .neq("status", "complete")
      .order("starts_at"),
  ]);

  const items: UpcomingItem[] = [];

  for (const s of (sessions as SessionRow[] | null) ?? []) {
    if (!s.starts_at || !s.league) continue;
    items.push({
      kind: "session",
      href: `/leagues/${s.league.slug}/sessions/${s.slug}`,
      name: s.name ?? s.league.name,
      game: s.league.game,
      format: s.league.format,
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
      format: null,
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
