import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUpcoming } from "@/lib/agenda";
import { getMyPlayer } from "@/lib/players";
import { updateMyPokemonIdAction } from "@/app/actions/players";
import { isToday, isThisWeek } from "@/lib/format";
import { CATEGORIES } from "@/lib/event-category";
import { buildFilterHref, ACTIVE_FILTER_CLASS } from "@/lib/filter-href";
import { groupThisWeek, type WeekGroupKey } from "@/lib/week-groups";
import { PageTabs } from "@/components/page-tabs";
import { PlayerIdPrompt } from "@/components/player-id-prompt";
import { UpcomingRow } from "@/components/upcoming-row";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

const WEEK_TAB_LABEL_KEY: Record<WeekGroupKey, string> = {
  sessions: "weekTabSessions",
  tcg: "weekTabTcg",
  vgc: "weekTabVgc",
  others: "weekTabOthers",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; type?: string; page?: string }>;
}) {
  const t = await getTranslations("landing");
  const sp = await searchParams;
  const gameFilter = sp.game === "tcg" || sp.game === "vgc" ? sp.game : null;
  const typeFilter = sp.type ?? null;

  const player = await getMyPlayer();
  const allUpcoming = await getUpcoming();
  const todayItems = allUpcoming.filter((u) => isToday(u.startsAt));
  const thisWeekItems = allUpcoming.filter((u) => isThisWeek(u.startsAt));
  const upcoming = allUpcoming.filter((u) => {
    if (gameFilter && u.game !== gameFilter) return false;
    if (!typeFilter) return true;
    if (typeFilter === "session") return u.kind === "session";
    return u.kind === "event" && u.category === typeFilter;
  });

  // "Esta semana" is split into tabs (Ligas / TCG / VG / Otros); only the
  // non-empty groups become tabs and the first one opens by default.
  const weekTabs = groupThisWeek(thisWeekItems).map((g) => ({
    value: g.key,
    label: `${t(WEEK_TAB_LABEL_KEY[g.key])} (${g.items.length})`,
    content: (
      <div className="flex flex-col gap-2">
        {g.items.map((u) => (
          <UpcomingRow
            key={u.href}
            item={u}
            variant="card"
            badge={t("thisWeekBadge")}
            sessionLabel={t("session")}
          />
        ))}
      </div>
    ),
  }));

  const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
  const pageNum = Math.min(
    Math.max(1, Number(sp.page) || 1),
    totalPages,
  );
  const pageItems = upcoming.slice(
    (pageNum - 1) * PAGE_SIZE,
    pageNum * PAGE_SIZE,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {player && !player.pokemon_id && (
        <PlayerIdPrompt
          action={updateMyPokemonIdAction}
          labels={{
            title: t("playerIdPromptTitle"),
            description: t("playerIdPromptDesc"),
            placeholder: t("playerIdPromptPlaceholder"),
            save: t("save"),
          }}
        />
      )}

      {todayItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("todayTitle")}</h2>
          <div className="flex flex-col gap-2">
            {todayItems.map((u) => (
              <UpcomingRow
                key={u.href}
                item={u}
                variant="card"
                badge={t("todayBadge")}
                sessionLabel={t("session")}
              />
            ))}
          </div>
        </section>
      )}

      {weekTabs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("thisWeekTitle")}</h2>
          <PageTabs tabs={weekTabs} initial={weekTabs[0].value} />
        </section>
      )}

      {/* Upcoming sessions + events */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("upcoming")}</h2>

        {allUpcoming.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("filterGameLabel")}
              </span>
              {(["", "tcg", "vgc"] as const).map((g) => (
                <Button
                  key={g || "all"}
                  asChild
                  size="sm"
                  variant="outline"
                  className={(gameFilter ?? "") === g ? ACTIVE_FILTER_CLASS : undefined}
                >
                  <Link
                    href={buildFilterHref("/", sp, {
                      game: g || "all",
                      page: undefined,
                    })}
                  >
                    {g ? g.toUpperCase() : t("filterAllGames")}
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("filterTypeLabel")}
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className={!typeFilter ? ACTIVE_FILTER_CLASS : undefined}
              >
                <Link href={buildFilterHref("/", sp, { type: undefined, page: undefined })}>
                  {t("filterAllCategories")}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className={typeFilter === "session" ? ACTIVE_FILTER_CLASS : undefined}
              >
                <Link href={buildFilterHref("/", sp, { type: "session", page: undefined })}>
                  {t("session")}
                </Link>
              </Button>
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                  <Button
                    key={c.value}
                    asChild
                    size="sm"
                    variant="outline"
                    className={typeFilter === c.value ? ACTIVE_FILTER_CLASS : undefined}
                  >
                    <Link href={buildFilterHref("/", sp, { type: c.value, page: undefined })}>
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {allUpcoming.length === 0 ? t("noUpcoming") : t("noMatches")}
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
              {pageItems.map((u) => (
                <li key={u.href}>
                  <UpcomingRow item={u} variant="list" sessionLabel={t("session")} />
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                {pageNum <= 1 ? (
                  <Button size="sm" variant="outline" disabled>
                    {t("prevPage")}
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={buildFilterHref("/", sp, {
                        page: pageNum - 1 > 1 ? String(pageNum - 1) : undefined,
                      })}
                    >
                      {t("prevPage")}
                    </Link>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {t("pageOf", { page: pageNum, total: totalPages })}
                </span>
                {pageNum >= totalPages ? (
                  <Button size="sm" variant="outline" disabled>
                    {t("nextPage")}
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href={buildFilterHref("/", sp, { page: String(pageNum + 1) })}>
                      {t("nextPage")}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
