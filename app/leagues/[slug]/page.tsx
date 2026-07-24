import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Calendar, MapPin, Coins } from "lucide-react";
import {
  getLeagueBySlug,
  getLeagueMatchesBySession,
  isLeagueAdmin,
  formatLabel,
} from "@/lib/leagues";
import { listSessions } from "@/lib/sessions";
import { computeLeagueStandings } from "@/lib/league-standings";
import { computePrizePool, QUARTER_POOL_SIZE, YEAR_POOL_SIZE } from "@/lib/prize-pool";
import { currentTrimestre, trimestreOf } from "@/lib/trimestre";
import { getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { formatDateTime, formatCost, formatMonthRange } from "@/lib/format";
import { weekdayLabel, formatTimeOfDay } from "@/lib/weekday";
import { CreateSessionForm } from "@/components/create-session-form";
import { GameBadge } from "@/components/game-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT = {
  setup: "secondary",
  active: "default",
  complete: "outline",
} as const;

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const t = await getTranslations("league");
  const tp = await getTranslations("leaguePrizes");
  const [admin, sessions, matchSessions] = await Promise.all([
    isLeagueAdmin(league.id),
    listSessions(league.id),
    getLeagueMatchesBySession(league.id),
  ]);

  const pointCfg = {
    winValue: league.win_value,
    drawValue: league.draw_value,
    attendanceValue: league.attendance_value,
  };
  const quarterSessions = matchSessions.filter(
    (s) => trimestreOf(s.startsAt) === currentTrimestre(),
  );
  const yearRows = computeLeagueStandings(matchSessions.map((s) => s.matches), pointCfg);
  const quarterRows = computeLeagueStandings(quarterSessions.map((s) => s.matches), pointCfg);
  const yearLeaderId = yearRows[0]?.playerId;
  const quarterLeaderId = quarterRows[0]?.playerId;
  const leaderNames = await getPlayersByIds(
    [yearLeaderId, quarterLeaderId].filter((id): id is string => !!id),
  );
  const leaderName = (id: string | undefined) => {
    if (!id) return null;
    const p = leaderNames.get(id);
    return p ? pairingName(p) : null;
  };
  const yearPool = computePrizePool(yearRows, YEAR_POOL_SIZE);
  const quarterPool = computePrizePool(quarterRows, QUARTER_POOL_SIZE);
  const yearLeaderName = leaderName(yearLeaderId);
  const quarterLeaderName = leaderName(quarterLeaderId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {league.name}
            </h1>
            <GameBadge game={league.game} />
            {formatLabel(league.format) && (
              <Badge variant="outline">{formatLabel(league.format)}</Badge>
            )}
            {league.subtitle && (
              <Badge variant="outline">{league.subtitle}</Badge>
            )}
            {league.archived_at && (
              <Badge variant="outline">{t("archivedBadge")}</Badge>
            )}
          </div>
          {league.description && (
            <p className="text-muted-foreground">{league.description}</p>
          )}
          {formatMonthRange(league.starts_month, league.ends_month) && (
            <p className="text-sm text-muted-foreground">
              {formatMonthRange(league.starts_month, league.ends_month)}
              {weekdayLabel(league.session_weekday) && formatTimeOfDay(league.session_time) && (
                <> · {weekdayLabel(league.session_weekday)}, {formatTimeOfDay(league.session_time)}</>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/leagues/${slug}/clasificacion`}>
              {t("standingsLink")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/leagues/${slug}/arquetipos`}>
              {t("archetypesLink")}
            </Link>
          </Button>
          {admin && (
            <Button asChild variant="outline">
              <Link href={`/leagues/${slug}/admin`}>{t("manage")}</Link>
            </Button>
          )}
        </div>
      </div>

      {(quarterRows.length > 0 || yearRows.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{tp("title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            {quarterRows.length > 0 && (
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  {tp("quarterTitle", { n: currentTrimestre() })}
                </span>
                <span className="font-medium">{tp("pool", { n: quarterPool })}</span>
                {quarterLeaderName && (
                  <Link
                    href={`/players/${quarterLeaderId}`}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    {tp("leader", { name: quarterLeaderName })}
                  </Link>
                )}
              </div>
            )}
            {yearRows.length > 0 && (
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{tp("yearTitle")}</span>
                <span className="font-medium">{tp("pool", { n: yearPool })}</span>
                {yearLeaderName && (
                  <Link
                    href={`/players/${yearLeaderId}`}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    {tp("leader", { name: yearLeaderName })}
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground">{t("noSessions")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/leagues/${slug}/sessions/${s.slug}`}
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{s.name ?? league.name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                        {formatDateTime(s.starts_at) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(s.starts_at)}
                          </span>
                        )}
                        {s.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {s.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5" />
                          {formatCost(s.cost)}
                        </span>
                      </span>
                    </span>
                    <Badge variant={STATUS_VARIANT[s.status]}>
                      {t(`status_${s.status}`)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("createSession")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateSessionForm
              leagueId={league.id}
              slug={slug}
              locations={league.locations}
              defaultLocation={league.default_location}
              labels={{
                startsAt: t("sStartsAt"),
                location: t("sLocation"),
                locationPlaceholder: t("sLocationPlaceholder"),
                cost: t("sCost"),
                capacity: t("sCapacity"),
                capacityHint: t("sCapacityHint"),
                cta: t("sCreate"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
