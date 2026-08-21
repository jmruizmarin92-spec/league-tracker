import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveArchetypes, type ArchetypeChip } from "@/lib/archetypes";
import type { Game } from "@/lib/leagues";

// A saved archetype combo (PL-3): the two picker keys a player usually runs
// together, remembered per account + game. Display = the resolved chips.
export type Deck = {
  id: string;
  game: Game;
  a1: string;
  a2: string;
  chips: ArchetypeChip[];
  lastUsedAt: string;
};

type DeckRow = {
  id: string;
  game: Game;
  archetype1: string;
  archetype2: string | null;
  last_used_at: string;
};

// The caller's saved decks, most recently used first. Keys that no longer
// resolve (a custom archetype that was deleted) are dropped from the deck, and
// a deck left with nothing is hidden so the picker never offers an empty chip.
export async function listMyDecks(game?: Game): Promise<Deck[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  let query = supabase
    .from("player_decks")
    .select("id, game, archetype1, archetype2, last_used_at")
    .order("last_used_at", { ascending: false });
  if (game) query = query.eq("game", game);
  const { data } = await query;
  const rows = (data as DeckRow[] | null) ?? [];

  const chips = await resolveArchetypes(
    rows.flatMap((r) => [r.archetype1, r.archetype2]),
  );
  return rows
    .map((r) => {
      const a1 = chips.has(r.archetype1) ? r.archetype1 : "";
      const a2 = r.archetype2 && chips.has(r.archetype2) ? r.archetype2 : "";
      return {
        id: r.id,
        game: r.game,
        a1,
        a2,
        chips: [a1, a2]
          .map((k) => (k ? chips.get(k) : undefined))
          .filter((c): c is ArchetypeChip => !!c),
        lastUsedAt: r.last_used_at,
      };
    })
    .filter((d) => d.chips.length > 0);
}

// The picker's initial slots for a player with no picks yet: their most
// recently used deck of this game, if any (listMyDecks is already sorted).
export function latestDeck(decks: Deck[], game: Game): Deck | null {
  return decks.find((d) => d.game === game) ?? null;
}
