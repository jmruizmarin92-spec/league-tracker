import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listEvents, type EventRow } from "@/lib/events";
import { eventToUpcomingItem } from "@/lib/agenda";
import { splitEventHistory } from "@/lib/event-history";
import { startOfTodayIso } from "@/lib/format";
import { CATEGORIES } from "@/lib/event-category";
import { buildFilterHref, ACTIVE_FILTER_CLASS } from "@/lib/filter-href";
import { UpcomingRow } from "@/components/upcoming-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT = {
  open: "default",
  closed: "secondary",
  complete: "outline",
} as const;

/**
 * Every standalone event (PL-30): Próximos on top, Anteriores below, so a
 * cup that already ran is still reachable with its pairings, standings and
 * archetype stats — the landing page only ever shows what is yet to come.
 * Filters by game and category apply to both sections.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; category?: string }>;
}) {
  const t = await getTranslations("events");
  const sp = await searchParams;
  const gameFilter = sp.game === "tcg" || sp.game === "vgc" ? sp.game : null;
  const categoryFilter = sp.category ?? null;

  const allEvents = await listEvents();
  const filtered = allEvents.filter(
    (e) =>
      (!gameFilter || e.game === gameFilter) &&
      (!categoryFilter || e.category === categoryFilter),
  );
  const { upcoming, past } = splitEventHistory(filtered, startOfTodayIso());
  const filtering = Boolean(gameFilter || categoryFilter);

  const renderList = (events: EventRow[], emptyKey: "noUpcoming" | "noPast") =>
    events.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        {filtering ? t("noMatches") : t(emptyKey)}
      </p>
    ) : (
      <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
        {events.map((e) => (
          <li key={e.id}>
            <UpcomingRow
              item={eventToUpcomingItem(e)}
              variant="list"
              sessionLabel=""
              trailing={
                emptyKey === "noPast" ? (
                  <Badge variant={STATUS_VARIANT[e.status]}>{t(`status_${e.status}`)}</Badge>
                ) : undefined
              }
            />
          </li>
        ))}
      </ul>
    );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {allEvents.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
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
                  <Link href={buildFilterHref("/events", sp, { game: g || undefined })}>
                    {g ? g.toUpperCase() : t("filterAllGames")}
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("filterCategoryLabel")}
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className={!categoryFilter ? ACTIVE_FILTER_CLASS : undefined}
              >
                <Link href={buildFilterHref("/events", sp, { category: undefined })}>
                  {t("filterAllCategories")}
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
                    className={categoryFilter === c.value ? ACTIVE_FILTER_CLASS : undefined}
                  >
                    <Link href={buildFilterHref("/events", sp, { category: c.value })}>
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {t("upcomingTitle")} ({upcoming.length})
            </h2>
            {renderList(upcoming, "noUpcoming")}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {t("pastTitle")} ({past.length})
            </h2>
            {renderList(past, "noPast")}
          </section>
        </>
      )}
    </main>
  );
}
