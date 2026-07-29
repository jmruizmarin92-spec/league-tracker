import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getLeagueBySlug,
  getLeagueMatchesBySession,
  isLeagueAdmin,
  listLeagueAdmins,
  listAddableUsers,
} from "@/lib/leagues";
import { getProfile } from "@/lib/auth";
import { computeLeagueStandings } from "@/lib/league-standings";
import { computePrizePool, QUARTER_POOL_SIZE, YEAR_POOL_SIZE } from "@/lib/prize-pool";
import { getLeaguePrizeAwards, type PrizeScope } from "@/lib/prize-awards";
import { ALL_TRIMESTRES, trimestreOf } from "@/lib/trimestre";
import { getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import {
  removeLeagueAdminAction,
  addLeagueLocationAction,
  removeLeagueLocationAction,
  setDefaultLocationAction,
  setLeagueArchivedAction,
  awardLeaguePrizeAction,
  revokeLeaguePrizeAction,
  deleteLeagueAction,
} from "@/app/actions/leagues";
import { Input } from "@/components/ui/input";
import { LeagueDetailsForm } from "@/components/league-details-form";
import { LeaguePointsForm } from "@/components/league-points-form";
import { LeagueDurationForm } from "@/components/league-duration-form";
import { LeagueScheduleForm } from "@/components/league-schedule-form";
import { GenerateSessionsButton } from "@/components/generate-sessions-button";
import { AddAdminForm } from "@/components/add-admin-form";
import { weekdayLabel } from "@/lib/weekday";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LeagueAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (!(await isLeagueAdmin(league.id))) redirect(`/leagues/${slug}`);

  const t = await getTranslations("leagueAdmin");
  const tp = await getTranslations("leaguePrizes");
  const [admins, addable, viewerProfile, matchSessions, awards] = await Promise.all([
    listLeagueAdmins(league.id),
    listAddableUsers(league.id),
    getProfile(),
    getLeagueMatchesBySession(league.id),
    getLeaguePrizeAwards(league.id),
  ]);
  const isSiteAdmin = !!viewerProfile?.is_admin;

  const pointCfg = {
    winValue: league.win_value,
    drawValue: league.draw_value,
    attendanceValue: league.attendance_value,
  };
  const prizeScopes: {
    scope: PrizeScope;
    label: string;
    rows: ReturnType<typeof computeLeagueStandings>;
    pool: number;
  }[] = [
    ...ALL_TRIMESTRES.map((tr) => {
      const rows = computeLeagueStandings(
        matchSessions
          .filter((s) => trimestreOf(s.startsAt) === tr)
          .map((s) => s.matches),
        pointCfg,
      );
      return {
        scope: `q${tr}` as PrizeScope,
        label: tp("quarterTitle", { n: tr }),
        rows,
        pool: computePrizePool(rows, QUARTER_POOL_SIZE),
      };
    }),
    {
      scope: "year" as PrizeScope,
      label: tp("yearTitle"),
      rows: computeLeagueStandings(matchSessions.map((s) => s.matches), pointCfg),
      pool: computePrizePool(
        computeLeagueStandings(matchSessions.map((s) => s.matches), pointCfg),
        YEAR_POOL_SIZE,
      ),
    },
  ];
  const prizePlayerIds = [
    ...prizeScopes.map((s) => s.rows[0]?.playerId),
    ...[...awards.values()].map((a) => a.winnerPlayerId ?? undefined),
  ].filter((id): id is string => !!id);
  const prizeNames = await getPlayersByIds(prizePlayerIds);
  const prizeName = (id: string | undefined) => {
    if (!id) return null;
    const p = prizeNames.get(id);
    return p ? pairingName(p) : null;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{league.name}</p>
      </div>

      {/* League details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeagueDetailsForm
            leagueId={league.id}
            slug={slug}
            defaults={{
              name: league.name,
              subtitle: league.subtitle,
              game: league.game,
              format: league.format,
              prizes: league.prizes,
            }}
            labels={{
              name: t("fieldName"),
              subtitle: t("fieldSubtitle"),
              subtitleHint: t("subtitleHint"),
              game: t("fieldGame"),
              format: t("fieldFormat"),
              formatPlaceholder: t("formatPlaceholder"),
              prizes: t("fieldPrizes"),
              prizesHint: t("prizesHint"),
              save: t("save"),
              saved: t("saved"),
            }}
          />
        </CardContent>
      </Card>

      {/* Point configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pointsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaguePointsForm
            leagueId={league.id}
            slug={slug}
            defaults={{
              win: league.win_value,
              attendance: league.attendance_value,
              draw: league.draw_value,
            }}
            labels={{
              win: t("winValue"),
              attendance: t("attendanceValue"),
              draw: t("drawValue"),
              save: t("save"),
              saved: t("saved"),
              hint: t("pointsHint"),
            }}
          />
        </CardContent>
      </Card>

      {/* Prize pool award tracking */}
      <Card>
        <CardHeader>
          <CardTitle>{tp("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {prizeScopes.map(({ scope, label, rows, pool }) => {
              const leaderId = rows[0]?.playerId;
              const leaderName = prizeName(leaderId);
              const award = awards.get(scope);
              return (
                <li
                  key={scope}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{label}</span>
                    <span className="text-sm text-muted-foreground">
                      {leaderName ? tp("leader", { name: leaderName }) : t("noPrizeData")}
                      {" · "}
                      {tp("pool", { n: pool })}
                    </span>
                  </div>
                  {award ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {tp("awardedTo", {
                          name: prizeName(award.winnerPlayerId ?? undefined) ?? "—",
                          packs: award.packs,
                        })}
                      </Badge>
                      <form action={revokeLeaguePrizeAction}>
                        <input type="hidden" name="league_id" value={league.id} />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="scope" value={scope} />
                        <Button type="submit" variant="ghost" size="sm">
                          {tp("undo")}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <form action={awardLeaguePrizeAction}>
                      <input type="hidden" name="league_id" value={league.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="scope" value={scope} />
                      <input type="hidden" name="winner_player_id" value={leaderId ?? ""} />
                      <input type="hidden" name="packs" value={pool} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={rows.length === 0}
                      >
                        {tp("markAwarded")}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Season duration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("durationTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeagueDurationForm
            leagueId={league.id}
            slug={slug}
            defaults={{
              startsMonth: league.starts_month,
              endsMonth: league.ends_month,
            }}
            labels={{
              startMonth: t("fieldStartMonth"),
              endMonth: t("fieldEndMonth"),
              hint: t("durationHint"),
              save: t("save"),
              saved: t("saved"),
            }}
          />
        </CardContent>
      </Card>

      {/* Weekly schedule + bulk session generation */}
      <Card>
        <CardHeader>
          <CardTitle>{t("scheduleTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("scheduleHint")}</p>
          <LeagueScheduleForm
            leagueId={league.id}
            slug={slug}
            defaults={{
              weekday: league.session_weekday,
              time: league.session_time,
              cost: league.default_cost,
            }}
            labels={{
              weekday: t("fieldWeekday"),
              weekdayPlaceholder: t("weekdayPlaceholder"),
              time: t("fieldTime"),
              cost: t("fieldDefaultCost"),
              save: t("save"),
              saved: t("saved"),
            }}
          />
          {league.session_weekday != null && league.session_time != null && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <span className="text-sm font-medium">{t("generateTitle")}</span>
              <p className="text-sm text-muted-foreground">
                {t("generateHint", {
                  weekday: weekdayLabel(league.session_weekday) ?? "",
                })}
              </p>
              <GenerateSessionsButton
                leagueId={league.id}
                slug={slug}
                labels={{
                  cta: t("generateCta"),
                  created: t("generateCreated"),
                  none: t("generateNone"),
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locations (venue picklist) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("locationsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("locationsHint")}</p>
          {league.locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLocations")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {league.locations.map((loc) => (
                <li
                  key={loc}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{loc}</span>
                    {league.default_location === loc && (
                      <Badge>{t("defaultBadge")}</Badge>
                    )}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    {league.default_location !== loc && (
                      <form action={setDefaultLocationAction}>
                        <input type="hidden" name="league_id" value={league.id} />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="location" value={loc} />
                        <Button type="submit" variant="ghost" size="sm">
                          {t("makeDefault")}
                        </Button>
                      </form>
                    )}
                    <form action={removeLeagueLocationAction}>
                      <input type="hidden" name="league_id" value={league.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="location" value={loc} />
                      <Button type="submit" variant="outline" size="sm">
                        {t("remove")}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form
            action={addLeagueLocationAction}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input type="hidden" name="league_id" value={league.id} />
            <input type="hidden" name="slug" value={slug} />
            <Input
              name="location"
              maxLength={120}
              placeholder={t("locationPlaceholder")}
              className="sm:flex-1"
            />
            <Button type="submit">{t("addLocation")}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Admins */}
      <Card>
        <CardHeader>
          <CardTitle>{t("adminsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAdmins")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {admins.map((a) => (
                <li
                  key={a.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{a.display_name}</span>
                    <Badge variant={a.role === "owner" ? "default" : "secondary"}>
                      {a.role === "owner" ? t("roleOwner") : t("roleAdmin")}
                    </Badge>
                  </span>
                  {a.role !== "owner" && (
                    <form action={removeLeagueAdminAction}>
                      <input type="hidden" name="league_id" value={league.id} />
                      <input type="hidden" name="user_id" value={a.user_id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Button type="submit" variant="outline" size="sm">
                        {t("remove")}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("addAdmin")}</span>
            <AddAdminForm
              leagueId={league.id}
              slug={slug}
              users={addable}
              labels={{ placeholder: t("addAdminPlaceholder"), cta: t("add") }}
            />
          </div>
        </CardContent>
      </Card>

      {/* End / reactivate league */}
      <Card>
        <CardHeader>
          <CardTitle>{t("lifecycleTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            {league.archived_at ? t("endedHint") : t("activeHint")}
          </p>
          <form action={setLeagueArchivedAction}>
            <input type="hidden" name="league_id" value={league.id} />
            <input type="hidden" name="slug" value={slug} />
            <input
              type="hidden"
              name="archived"
              value={league.archived_at ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={league.archived_at ? "outline" : "destructive"}
            >
              {league.archived_at ? t("reactivate") : t("endLeague")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Hard delete (site admin only) */}
      {isSiteAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{t("dangerZone")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              {t("deleteLeagueHint")}
            </p>
            <form action={deleteLeagueAction}>
              <input type="hidden" name="league_id" value={league.id} />
              <ConfirmDeleteButton confirmMessage={t("confirmDeleteLeague")}>
                {t("deleteLeague")}
              </ConfirmDeleteButton>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
