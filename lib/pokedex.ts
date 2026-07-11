import pokedexData from "@/data/pokedex.json";

export type DexEntry = { id: number; name: string };

export const POKEDEX = pokedexData as DexEntry[];

const dexById = new Map<number, string>(POKEDEX.map((p) => [p.id, p.name]));

export function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export function pokemonName(id: number): string | null {
  return dexById.get(id) ?? null;
}
