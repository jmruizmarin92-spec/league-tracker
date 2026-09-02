import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listStores, listAllStoreAdmins, listProfilesForPicker } from "@/lib/stores";
import { listLeagues } from "@/lib/leagues";
import { listEvents } from "@/lib/events";
import { StoreList, CreateStoreForm } from "@/components/store-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminStoresPage() {
  await requireAdmin();
  const t = await getTranslations("stores");
  const [stores, leagues, events, rosters, users] = await Promise.all([
    listStores(),
    listLeagues(),
    listEvents(),
    listAllStoreAdmins(),
    listProfilesForPicker(),
  ]);
  const rows = stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    playLeagueId: s.play_league_id,
    leagues: leagues.filter((l) => l.store_id === s.id).length,
    events: events.filter((e) => e.store_id === s.id).length,
    admins: rosters.get(s.id) ?? [],
  }));
  const labels = {
    name: t("fName"),
    playLeagueId: t("fPlayLeagueId"),
    playLeagueIdHint: t("playLeagueIdHint"),
    save: t("save"),
    saved: t("saved"),
    delete: t("delete"),
    deleteConfirm: t("deleteConfirm"),
    leaguesCount: t("leaguesCount", { n: "{n}" }),
    eventsCount: t("eventsCount", { n: "{n}" }),
    createCta: t("createCta"),
    console: t("console"),
    adminsTitle: t("adminsTitle"),
    roster: {
      noAdmins: t("noAdmins"),
      roleOwner: t("roleOwner"),
      roleAdmin: t("roleAdmin"),
      roleLabel: t("roleLabel"),
      remove: t("remove"),
      addAdmin: t("addAdmin"),
      addAdminPlaceholder: t("addAdminPlaceholder"),
      add: t("add"),
      added: t("added"),
    },
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <p className="text-sm text-muted-foreground">{t("adminsHint")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <StoreList stores={rows} users={users} labels={labels} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("createTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateStoreForm labels={labels} />
        </CardContent>
      </Card>
    </main>
  );
}
