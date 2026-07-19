import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  computeGameLeagueArchetypeStats,
  computeGameEventArchetypeStats,
} from "@/lib/archetype-standings";
import { buildFilterHref, ACTIVE_FILTER_CLASS } from "@/lib/filter-href";
import { ArchetypeStatsTable } from "@/components/archetype-stats-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Game } from "@/lib/leagues";

const GAMES: Game[] = ["tcg", "vgc"];

export default async function OverallArchetypeStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const sp = await searchParams;
  const game: Game = sp.game === "vgc" ? "vgc" : "tcg";

  const t = await getTranslations("overallArchetypes");
  const tLeague = await getTranslations("leagueArchetypes");
  const tEvent = await getTranslations("eventArchetypes");
  const tb = await getTranslations("breadcrumbs");

  const [leagueRows, eventRows] = await Promise.all([
    computeGameLeagueArchetypeStats(game),
    computeGameEventArchetypeStats(game),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Breadcrumbs items={[{ label: tb("home"), href: "/" }, { label: t("title") }]} />
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {GAMES.map((g) => (
          <Button
            key={g}
            asChild
            variant="outline"
            size="sm"
            className={game === g ? ACTIVE_FILTER_CLASS : undefined}
          >
            <Link href={buildFilterHref("/arquetipos", sp, { game: g })}>
              {g.toUpperCase()}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionLeagues")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchetypeStatsTable
            rows={leagueRows}
            labels={{
              empty: t("emptyLeagues"),
              archetype: tLeague("archetype"),
              players: tLeague("players"),
              games: tLeague("games"),
              record: tLeague("record"),
              winRate: tLeague("winRate"),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionEvents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchetypeStatsTable
            rows={eventRows}
            showRecord={false}
            labels={{
              empty: t("emptyEvents"),
              archetype: tEvent("archetype"),
              players: tEvent("players"),
              percentage: tEvent("percentage"),
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
