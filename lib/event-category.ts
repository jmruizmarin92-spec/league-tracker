import { Trophy, Swords, Sparkles, PackageOpen, Tag, type LucideIcon } from "lucide-react";

export type Category = "cup" | "challenge" | "demo" | "prerelease" | "others";

export const CATEGORIES: { value: Category; label: string; icon: LucideIcon }[] = [
  { value: "cup", label: "Cup", icon: Trophy },
  { value: "challenge", label: "Challenge", icon: Swords },
  { value: "demo", label: "Demos", icon: Sparkles },
  { value: "prerelease", label: "Prelanzamiento", icon: PackageOpen },
  { value: "others", label: "Otros", icon: Tag },
];

export function categoryMeta(category: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === category) ?? null;
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((c) => c.value === value);
}

// Cups and challenges are sanctioned tournaments: a list is mandatory and
// walk-ins without an account may hand one in (PL-24). Both event flags
// default from this on creation (form + pokedata importer); the TO can still
// switch either off.
export function requiresListByDefault(category: string | null | undefined): boolean {
  return category === "cup" || category === "challenge";
}
