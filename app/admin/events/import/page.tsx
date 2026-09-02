import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listStores } from "@/lib/stores";
import { listLeagues } from "@/lib/leagues";
import { listEvents } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { matchSeasonLeague, type SeasonCandidate } from "@/lib/season-match";
import {
  fetchPokedataEvents,
  pokedataWindow,
  proposedEventName,
  seasonFormatFor,
  POKEDATA_ZONE,
} from "@/lib/pokedata";
import { PokedataImport, type ImportRow } from "@/components/pokedata-import";
import { Card, CardContent } from "@/components/ui/card";

// Cups and Challenges the official locator lists around Granada (PL-21),
// resolved against our stores and season leagues, ready to be created with
// one click. Site admins only: it creates events on any store.
export default async function AdminEventImportPage() {
  await requireAdmin();
  const t = await getTranslations("eventImport");
  const window = pokedataWindow();
  const [api, stores, leagueRows, events] = await Promise.all([
    fetchPokedataEvents({ ...POKEDATA_ZONE, ...window }),
    listStores(),
    listLeagues(),
    listEvents(),
  ]);

  const leagues: SeasonCandidate[] = leagueRows.map((l) => ({
    id: l.id,
    storeId: l.store_id,
    game: l.game,
    format: l.format,
    startsMonth: l.starts_month,
    endsMonth: l.ends_month,
    archived: l.archived_at !== null,
  }));
  const leagueName = (id: string) => leagueRows.find((l) => l.id === id)?.name ?? null;
  const existing = new Map(
    events.filter((e) => e.tournament_id).map((e) => [e.tournament_id as string, e]),
  );

  const rows: ImportRow[] = api.events.map((ev) => {
    const store = ev.playLeagueId
      ? stores.find((s) => s.play_league_id === ev.playLeagueId)
      : undefined;
    const done = ev.tournamentId ? existing.get(ev.tournamentId) : undefined;
    const season =
      store && ev.game
        ? matchSeasonLeague(leagues, {
            storeId: store.id,
            game: ev.game,
            format: seasonFormatFor(ev.game),
            startsAtLocal: ev.startsAtLocal,
          })
        : null;
    const state: ImportRow["state"] = done
      ? "imported"
      : !ev.tournamentId
        ? "noId"
        : !store
          ? "unknownStore"
          : !ev.game
            ? "unsupported"
            : "ready";
    return {
      key: ev.guid,
      tournamentId: ev.tournamentId,
      name: proposedEventName(ev, store?.name ?? ev.shop) ?? ev.title,
      subtitle: ev.series,
      game: ev.game,
      startsAt: formatDateTime(ev.startsAtIso),
      shop: ev.shop,
      city: ev.city,
      cost: ev.cost,
      url: ev.url,
      playLeagueId: ev.playLeagueId,
      storeName: store?.name ?? null,
      leagueName: season?.kind === "one" ? leagueName(season.id) : null,
      leagueKind: season?.kind ?? null,
      state,
      existingSlug: done?.slug ?? null,
    };
  });

  const labels = {
    selectAll: t("selectAll"),
    importCta: t("importCta", { n: "{n}" }),
    importing: t("importing"),
    alreadyImported: t("alreadyImported"),
    view: t("view"),
    unknownStore: t("unknownStore", { id: "{id}" }),
    unsupported: t("unsupported"),
    noId: t("noId"),
    shop: t("shop", { shop: "{shop}" }),
    store: t("store", { name: "{name}" }),
    league: t("league", { name: "{name}" }),
    leagueNone: t("leagueNone"),
    leagueMany: t("leagueMany"),
    free: t("free"),
    resultsTitle: t("resultsTitle"),
    resultOk: t("resultOk"),
    resultError: t("resultError"),
    playPage: t("playPage"),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("hint", { radius: POKEDATA_ZONE.radiusKm, start: window.start, end: window.end })}
        </p>
        <p className="text-sm text-muted-foreground">{t("storesHint")}</p>
        <p className="text-sm">
          <Link href="/admin/events" className="underline">
            {t("back")}
          </Link>
          {" · "}
          <a href={api.url} target="_blank" rel="noreferrer" className="underline">
            {t("source")}
          </a>
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {api.error ? (
            <p className="text-sm text-destructive">{t("apiError", { error: api.error })}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <PokedataImport rows={rows} labels={labels} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
