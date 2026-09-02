import Link from "next/link";
import { Calendar, MapPin, Coins } from "lucide-react";
import { formatLabel } from "@/lib/leagues";
import { GAME_ROW_TINT } from "@/lib/league-format";
import type { UpcomingItem } from "@/lib/agenda";
import { formatDateTime, formatCost } from "@/lib/format";
import { CategoryBadge } from "@/components/category-badge";
import { GameBadge } from "@/components/game-badge";
import { Badge } from "@/components/ui/badge";

const VARIANT_CLASS = {
  // Standalone highlighted card (Hoy / Esta semana).
  card: "rounded-lg border-2 border-primary/40",
  // Row inside a bordered, divided <ul> (Próximos).
  list: "",
} as const;

/**
 * One session/event line of the landing page. The same markup serves the
 * highlighted Hoy / Esta semana cards (`variant="card"`, optional leading
 * badge) and the plain rows of the Próximos list (`variant="list"`).
 */
export function UpcomingRow({
  item,
  variant,
  badge,
  sessionLabel,
}: {
  item: UpcomingItem;
  variant: keyof typeof VARIANT_CLASS;
  badge?: string;
  sessionLabel: string;
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between gap-3 p-3 transition-colors ${VARIANT_CLASS[variant]} ${GAME_ROW_TINT[item.game]}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {badge && <Badge className="bg-primary text-primary-foreground">{badge}</Badge>}
          <span className="truncate">{item.name}</span>
          <GameBadge game={item.game} />
          {formatLabel(item.format) && (
            <Badge variant="outline">{formatLabel(item.format)}</Badge>
          )}
          <CategoryBadge category={item.category} />
          {item.kind === "session" && <Badge variant="outline">{sessionLabel}</Badge>}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {item.subtitle && item.subtitle !== item.name && (
            <span className="font-medium">{item.subtitle}</span>
          )}
          {formatDateTime(item.startsAt) && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateTime(item.startsAt)}
            </span>
          )}
          {item.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {item.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Coins className="h-3.5 w-3.5" />
            {formatCost(item.cost)}
          </span>
        </span>
      </span>
    </Link>
  );
}
