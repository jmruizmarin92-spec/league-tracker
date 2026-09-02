import type { Game } from "@/lib/league-format";

// Tabs of the landing page's "Esta semana" block. Fixed order; a group with
// nothing in it is not rendered at all, so the tab strip only ever shows
// groups that have something behind them.
export const WEEK_GROUP_KEYS = ["sessions", "tcg", "vgc", "others"] as const;
export type WeekGroupKey = (typeof WEEK_GROUP_KEYS)[number];

// The slice of UpcomingItem the grouping needs — kept structural so the unit
// tests don't have to build full items.
export type WeekGroupable = {
  kind: "session" | "event";
  game: Game;
  category: string | null;
};

export type WeekGroup<T extends WeekGroupable> = {
  key: WeekGroupKey;
  items: T[];
};

// Only real Play! tournaments go under their game's tab. Demos, prereleases,
// "otros" and events with no category all land in the shared "Otros" tab.
const TOURNAMENT_CATEGORIES: ReadonlySet<string> = new Set(["cup", "challenge"]);

export function weekGroupKey(item: WeekGroupable): WeekGroupKey {
  if (item.kind === "session") return "sessions";
  if (item.category && TOURNAMENT_CATEGORIES.has(item.category)) return item.game;
  return "others";
}

// Splits the week's items into the non-empty groups, in tab order. Item order
// inside a group is the input order (already sorted by start time upstream).
export function groupThisWeek<T extends WeekGroupable>(items: T[]): WeekGroup<T>[] {
  const buckets: Record<WeekGroupKey, T[]> = {
    sessions: [],
    tcg: [],
    vgc: [],
    others: [],
  };
  for (const item of items) buckets[weekGroupKey(item)].push(item);
  return WEEK_GROUP_KEYS.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    items: buckets[key],
  }));
}
