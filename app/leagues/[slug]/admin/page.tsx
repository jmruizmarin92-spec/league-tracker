import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getLeagueBySlug,
  isLeagueAdmin,
  listLeagueAdmins,
  listAddableUsers,
} from "@/lib/leagues";
import { getProfile } from "@/lib/auth";
import {
  removeLeagueAdminAction,
  addLeagueLocationAction,
  removeLeagueLocationAction,
  setDefaultLocationAction,
  setLeagueArchivedAction,
  deleteLeagueAction,
} from "@/app/actions/leagues";
import { Input } from "@/components/ui/input";
import { LeaguePointsForm } from "@/components/league-points-form";
import { LeagueDurationForm } from "@/components/league-duration-form";
import { AddAdminForm } from "@/components/add-admin-form";
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
  const [admins, addable, viewerProfile] = await Promise.all([
    listLeagueAdmins(league.id),
    listAddableUsers(league.id),
    getProfile(),
  ]);
  const isSiteAdmin = !!viewerProfile?.is_admin;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{league.name}</p>
      </div>

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
