export type Game = "tcg" | "vgc";

// TCG leagues choose Standard or GLC; VGC leagues are always Champions.
export const FORMATS_BY_GAME: Record<Game, { value: string; label: string }[]> = {
  tcg: [
    { value: "standard", label: "Estándar" },
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
