import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLeagueBySlug } from "@/lib/leagues";
import { computeLeagueArchetypeStats } from "@/lib/archetype-standings";
import { Card, CardContent } from "@/components/ui/card";

export default async function LeagueArchetypeStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const t = await getTranslations("leagueArchetypes");
  const rows = await computeLeagueArchetypeStats(league.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/leagues/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {league.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">{t("archetype")}</th>
                    <th className="py-2 pr-2 text-right font-medium">
                      {t("players")}
                    </th>
                    <th className="py-2 pr-2 text-right font-medium">
                      {t("games")}
                    </th>
                    <th className="py-2 pr-2 text-right font-medium">
                      {t("record")}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t("winRate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <span className="flex items-center gap-1.5">
                          {r.chip?.icon && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.chip.icon}
                              alt=""
                              className="h-6 w-6"
                            />
                          )}
                          <span className="truncate">
                            {r.chip?.name ?? r.key}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {r.players}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {r.games}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {r.wins}-{r.losses}-{r.draws}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {(r.winRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
