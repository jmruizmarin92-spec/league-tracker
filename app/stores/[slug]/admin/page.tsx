import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import {
  getStoreBySlug,
  isStoreAdmin,
  isStoreOwner,
  listAddableStoreUsers,
  listStoreAdmins,
} from "@/lib/stores";
import { listLeagues, formatLabel } from "@/lib/leagues";
import { listEvents } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { eventFormLabels, leagueFormLabels } from "@/lib/form-labels";
import { CreateEventForm } from "@/components/create-event-form";
import { CreateLeagueForm } from "@/components/create-league-form";
import { StoreDetailsForm } from "@/components/store-details-form";
import { StorePrizeDefaultsForm } from "@/components/store-prize-defaults-form";
import { getStorePrizeDefaults } from "@/lib/event-prize-budget";
import { StoreRoster } from "@/components/store-roster";
import { GameBadge } from "@/components/game-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Store console (PL-17): what a store's owners/admins get instead of the
// site-wide /admin pages. Everything here is scoped to this store — its
// seasons, its events, its roster — and the create forms carry the store
// fixed so a store admin can only create under their own store.
export default async function StoreAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  if (!(await isStoreAdmin(store.id))) redirect("/");

  const [t, ts, te, tl, profile, isOwner, admins, addable, allLeagues, allEvents, prizeDefaults] =
    await Promise.all([
      getTranslations("storeAdmin"),
      getTranslations("stores"),
      getTranslations("events"),
      getTranslations("leagues"),
      getProfile(),
      isStoreOwner(store.id),
      listStoreAdmins(store.id),
      listAddableStoreUsers(store.id),
      listLeagues(),
      listEvents(),
      getStorePrizeDefaults(store.id),
    ]);
  const isSiteAdmin = !!profile?.is_admin;
  const leagues = allLeagues.filter((l) => l.store_id === store.id);
  const events = allEvents.filter((e) => e.store_id === store.id);

  const rosterLabels = {
    noAdmins: ts("noAdmins"),
    roleOwner: ts("roleOwner"),
    roleAdmin: ts("roleAdmin"),
    roleLabel: ts("roleLabel"),
    remove: ts("remove"),
    addAdmin: ts("addAdmin"),
    addAdminPlaceholder: ts("addAdminPlaceholder"),
    add: ts("add"),
    added: ts("added"),
  };
  const statusLabel = (s: string) => te(`status_${s}`);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {store.name}
          {" · "}
          {store.play_league_id
            ? t("playLeagueId", { id: store.play_league_id })
            : ts("noPlayId")}
        </p>
        {isSiteAdmin && (
          <Link
            href="/admin/stores"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("allStores")}
          </Link>
        )}
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StoreDetailsForm
            storeId={store.id}
            slug={store.slug}
            defaults={{ name: store.name, playLeagueId: store.play_league_id }}
            labels={{
              name: ts("fName"),
              playLeagueId: ts("fPlayLeagueId"),
              playLeagueIdHint: ts("playLeagueIdHint"),
              save: ts("save"),
              saved: ts("saved"),
            }}
          />
        </CardContent>
      </Card>

      {/* Prize budget defaults (PL-29) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("prizeDefaultsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("prizeDefaultsHint")}</p>
          <StorePrizeDefaultsForm
            storeId={store.id}
            slug={store.slug}
            defaults={{
              venueFee: prizeDefaults?.venue_fee ?? 0,
              judgeFee: prizeDefaults?.judge_fee ?? 0,
              entryPack: prizeDefaults?.entry_pack ?? false,
              packValue: prizeDefaults?.pack_value ?? 0,
            }}
          />
        </CardContent>
      </Card>

      {/* Seasons of the store */}
      <Card>
        <CardHeader>
          <CardTitle>{t("leaguesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {leagues.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLeagues")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {leagues.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{l.name}</span>
                    <GameBadge game={l.game} />
                    {formatLabel(l.format) && (
                      <span className="text-sm text-muted-foreground">
                        {formatLabel(l.format)}
                      </span>
                    )}
                    {l.archived_at && <Badge variant="outline">{t("archived")}</Badge>}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/leagues/${l.slug}`}>{t("view")}</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/leagues/${l.slug}/admin`}>{t("manage")}</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 border-t pt-4">
            <span className="text-sm font-medium">{t("createLeagueTitle")}</span>
            <CreateLeagueForm
              stores={[{ id: store.id, name: store.name }]}
              fixedStoreId={store.id}
              labels={leagueFormLabels(tl)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Events of the store */}
      <Card>
        <CardHeader>
          <CardTitle>{t("eventsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{e.name}</span>
                      <GameBadge game={e.game} />
                      <Badge variant={e.status === "open" ? "default" : "secondary"}>
                        {statusLabel(e.status)}
                      </Badge>
                    </span>
                    {formatDateTime(e.starts_at) && (
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(e.starts_at)}
                      </span>
                    )}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/events/${e.slug}`}>{t("view")}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 border-t pt-4">
            <span className="text-sm font-medium">{t("createEventTitle")}</span>
            <CreateEventForm
              stores={[{ id: store.id, name: store.name, playLeagueId: store.play_league_id }]}
              fixedStoreId={store.id}
              leagues={leagues.map((l) => ({
                id: l.id,
                name: l.name,
                storeId: l.store_id,
                game: l.game,
                format: l.format,
                startsMonth: l.starts_month,
                endsMonth: l.ends_month,
                archived: l.archived_at !== null,
              }))}
              labels={eventFormLabels(te)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card>
        <CardHeader>
          <CardTitle>{t("adminsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("adminsHint")}</p>
          <StoreRoster
            storeId={store.id}
            slug={store.slug}
            admins={admins}
            users={addable}
            canManage={isOwner}
            canSetOwner={isSiteAdmin}
            labels={rosterLabels}
          />
        </CardContent>
      </Card>
    </main>
  );
}
