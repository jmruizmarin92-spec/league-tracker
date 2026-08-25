import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listLeagues } from "@/lib/leagues";
import { listStores } from "@/lib/stores";
import { CreateEventForm } from "@/components/create-event-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminEventsPage() {
  await requireAdmin();
  const t = await getTranslations("events");
  const [leagueRows, storeRows] = await Promise.all([listLeagues(), listStores()]);
  const stores = storeRows.map((s) => ({
    id: s.id,
    name: s.name,
    playLeagueId: s.play_league_id,
  }));
  const leagues = leagueRows.map((l) => ({
    id: l.id,
    name: l.name,
    storeId: l.store_id,
    game: l.game,
    format: l.format,
    startsMonth: l.starts_month,
    endsMonth: l.ends_month,
    archived: l.archived_at !== null,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("createTitle")}</h1>

      <Card>
        <CardContent className="pt-6">
          <CreateEventForm
            stores={stores}
            leagues={leagues}
            labels={{
              name: t("fName"),
              subtitle: t("fSubtitle"),
              subtitleHint: t("subtitleHint"),
              category: t("fCategory"),
              categoryPlaceholder: t("categoryPlaceholder"),
              categoryNone: t("categoryNone"),
              game: t("fGame"),
              gamePlaceholder: t("gamePlaceholder"),
              store: t("fStore"),
              storeNone: t("storeNone"),
              league: t("fLeague"),
              leaguePlaceholder: t("leaguePlaceholder"),
              leagueNone: t("leagueNone"),
              tournamentId: t("fTournamentId"),
              tournamentIdHint: t("tournamentIdHint"),
              status: t("fStatus"),
              statusOpen: t("status_open"),
              statusClosed: t("status_closed"),
              statusComplete: t("status_complete"),
              startsAt: t("fStartsAt"),
              location: t("fLocation"),
              cost: t("fCost"),
              capacity: t("fCapacity"),
              capacityHint: t("capacityHint"),
              externalUrl: t("fExternalUrl"),
              externalUrlHint: t("externalUrlHint"),
              description: t("fDescription"),
              prizes: t("fPrizes"),
              prizesHint: t("prizesHint"),
              listRequired: t("fListRequired"),
              listLock: t("fListLock"),
              listLockHint: t("listLockHint"),
              pasteTitle: t("pasteTitle"),
              pasteHint: t("pasteHint"),
              pastePlaceholder: t("pastePlaceholder"),
              pasteCta: t("pasteCta"),
              pasteFilled: t("pasteFilled"),
              pasteError: t("pasteError"),
              pasteStoreMatched: t("pasteStoreMatched", { name: "{name}" }),
              pasteStoreMissing: t("pasteStoreMissing", { id: "{id}" }),
              pasteLeagueMatched: t("pasteLeagueMatched", { name: "{name}" }),
              pasteLeagueNone: t("pasteLeagueNone"),
              pasteLeagueMany: t("pasteLeagueMany"),
              pasteNoLeagueId: t("pasteNoLeagueId"),
              cta: t("createCta"),
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
