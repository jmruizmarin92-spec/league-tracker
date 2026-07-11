import { pokemonName, spriteUrl } from "@/lib/pokedex";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/leagues";

export type ArchetypeChip = { key: string; name: string; icon: string | null };

export type Custom = {
  id: string;
  game: Game;
  name: string;
  icon_url: string | null;
  active: boolean;
};

export async function listCustoms(game?: Game): Promise<Custom[]> {
  const supabase = await createClient();
  let query = supabase.from("archetype_customs").select("*").order("name");
  if (game) query = query.eq("game", game);
  const { data } = await query;
  return (data as Custom[] | null) ?? [];
}

// Resolve a set of participant keys ('pkm:<id>' | 'cst:<uuid>') to display chips.
export async function resolveArchetypes(
  keys: (string | null | undefined)[],
): Promise<Map<string, ArchetypeChip>> {
  const map = new Map<string, ArchetypeChip>();

  const customIds = [
    ...new Set(
      keys
        .filter((k): k is string => !!k && k.startsWith("cst:"))
        .map((k) => k.slice(4)),
    ),
  ];

  const customs = new Map<string, { name: string; icon_url: string | null }>();
  if (customIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("archetype_customs")
      .select("id, name, icon_url")
      .in("id", customIds);
    for (const c of (data as { id: string; name: string; icon_url: string | null }[] | null) ?? []) {
      customs.set(c.id, { name: c.name, icon_url: c.icon_url });
    }
  }

  for (const k of keys) {
    if (!k || map.has(k)) continue;
    if (k.startsWith("pkm:")) {
      const id = Number(k.slice(4));
      const name = pokemonName(id);
      if (name) map.set(k, { key: k, name, icon: spriteUrl(id) });
    } else if (k.startsWith("cst:")) {
      const c = customs.get(k.slice(4));
      if (c) map.set(k, { key: k, name: c.name, icon: c.icon_url });
    }
  }
  return map;
}
