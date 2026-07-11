import { Trophy, Swords, Sparkles, Tag, type LucideIcon } from "lucide-react";

export type Category = "cup" | "challenge" | "demo" | "others";

export const CATEGORIES: { value: Category; label: string; icon: LucideIcon }[] = [
  { value: "cup", label: "Cup", icon: Trophy },
  { value: "challenge", label: "Challenge", icon: Swords },
  { value: "demo", label: "Demo", icon: Sparkles },
  { value: "others", label: "Otros", icon: Tag },
];

export function categoryMeta(category: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === category) ?? null;
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((c) => c.value === value);
}
