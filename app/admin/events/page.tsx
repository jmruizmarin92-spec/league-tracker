import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listLeagues } from "@/lib/leagues";
import { listStores } from "@/lib/stores";
import { eventFormLabels } from "@/lib/form-labels";
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
            labels={eventFormLabels(t)}
          />
        </CardContent>
      </Card>
    </main>
  );
}
