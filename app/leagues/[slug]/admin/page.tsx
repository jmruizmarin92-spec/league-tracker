import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getLeagueBySlug,
  isLeagueAdmin,
  listLeagueAdmins,
  listAddableUsers,
} from "@/lib/leagues";
import { removeLeagueAdminAction } from "@/app/actions/leagues";
import { LeaguePointsForm } from "@/components/league-points-form";
import { AddAdminForm } from "@/components/add-admin-form";
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
  const [admins, addable] = await Promise.all([
    listLeagueAdmins(league.id),
    listAddableUsers(league.id),
  ]);

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

      {/* Admins */}
      <Card>
        <CardHeader>
          <CardTitle>{t("adminsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y">
            {admins.map((a) => (
              <li
                key={a.user_id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="flex items-center gap-2">
                  {a.display_name}
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
    </main>
  );
}
