import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLeagueBySlug, getLeagueMatchesBySession } from "@/lib/leagues";
import { computeLeagueStandings } from "@/lib/league-standings";
import { ALL_TRIMESTRES, currentTrimestre, trimestreOf, type Trimestre } from "@/lib/trimestre";
import { getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { buildFilterHref, ACTIVE_FILTER_CLASS } from "@/lib/filter-href";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function LeagueStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ trimestre?: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const t = await getTranslations("leagueStandings");
  const tb = await getTranslations("breadcrumbs");
  const sp = await searchParams;

  const sessions = await getLeagueMatchesBySession(league.id);
  const availableTrimestres = ALL_TRIMESTRES.filter((tr) =>
    sessions.some((s) => trimestreOf(s.startsAt) === tr),
  );

  const requested = sp.trimestre;
  const requestedTrimestre =
    requested && requested !== "general" ? (Number(requested) as Trimestre) : null;
  const selected: Trimestre | "general" =
    requestedTrimestre && availableTrimestres.includes(requestedTrimestre)
      ? requestedTrimestre
      : !requested && availableTrimestres.includes(currentTrimestre())
        ? currentTrimestre()
        : "general";

  const scopedSessions =
    selected === "general"
      ? sessions
      : sessions.filter((s) => trimestreOf(s.startsAt) === selected);

  const rows = computeLeagueStandings(
    scopedSessions.map((s) => s.matches),
    {
      winValue: league.win_value,
      drawValue: league.draw_value,
      attendanceValue: league.attendance_value,
    },
  );
  const nameMap = await getPlayersByIds(rows.map((r) => r.playerId));
  const name = (id: string) => {
    const p = nameMap.get(id);
    return p ? pairingName(p) : "—";
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Breadcrumbs
          items={[
            { label: tb("home"), href: "/" },
            { label: league.name, href: `/leagues/${slug}` },
            { label: t("title") },
          ]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("formula", {
            win: league.win_value,
            attendance: league.attendance_value,
          })}
        </p>
        {league.prizes && (
          <p className="text-sm text-muted-foreground">
            {t("prizes")}: {league.prizes}
          </p>
        )}
      </div>

      {availableTrimestres.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {availableTrimestres.map((tr) => (
            <Button
              key={tr}
              asChild
              size="sm"
              variant="outline"
              className={selected === tr ? ACTIVE_FILTER_CLASS : undefined}
            >
              <Link href={buildFilterHref(`/leagues/${slug}/clasificacion`, sp, { trimestre: String(tr) })}>
                {t("trimestre", { n: tr })}
              </Link>
            </Button>
          ))}
          <Button
            asChild
            size="sm"
            variant="outline"
            className={selected === "general" ? ACTIVE_FILTER_CLASS : undefined}
          >
            <Link href={buildFilterHref(`/leagues/${slug}/clasificacion`, sp, { trimestre: "general" })}>
              {t("overall")}
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">{t("rank")}</th>
                    <th className="py-2 pr-2 font-medium">{t("player")}</th>
                    <th className="py-2 pr-2 text-right font-medium">
                      {t("points")}
                    </th>
                    <th className="py-2 pr-2 text-right font-medium">
                      {t("wins")}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t("attended")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.playerId} className="border-b last:border-0">
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                        {r.rank}
                      </td>
                      <td className="py-2 pr-2">
                        <Link
                          href={`/players/${r.playerId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {name(r.playerId)}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-right font-medium tabular-nums">
                        {r.leaguePoints}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {r.wins}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {r.attended}
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
