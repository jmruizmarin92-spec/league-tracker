export type Game = "tcg" | "vgc";

// Subtle per-game background wash for list rows/cards, matching the blue/red
// tone used by GameBadge.
export const GAME_ROW_TINT: Record<Game, string> = {
  tcg: "bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-500/10 dark:hover:bg-blue-500/15",
  vgc: "bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/10 dark:hover:bg-red-500/15",
};

// TCG leagues choose Standard or GLC; VGC leagues are always Champions.
export const FORMATS_BY_GAME: Record<Game, { value: string; label: string }[]> = {
  tcg: [
    { value: "standard", label: "Standard" },
    { value: "glc", label: "GLC" },
  ],
  vgc: [{ value: "champions", label: "Champions" }],
};

export function formatLabel(format: string | null): string | null {
  if (!format) return null;
  for (const list of Object.values(FORMATS_BY_GAME)) {
    const found = list.find((f) => f.value === format);
    if (found) return found.label;
  }
  return null;
}
