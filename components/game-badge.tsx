import { Badge } from "@/components/ui/badge";
import type { Game } from "@/lib/league-format";

const STYLES: Record<Game, string> = {
  tcg: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  vgc: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function GameBadge({ game }: { game: Game }) {
  return (
    <Badge variant="secondary" className={STYLES[game]}>
      {game.toUpperCase()}
    </Badge>
  );
}
