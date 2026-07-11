import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Calendar, MapPin, Coins } from "lucide-react";
import { formatLabel } from "@/lib/leagues";
import { getUpcoming } from "@/lib/agenda";
import { formatDateTime, formatCost } from "@/lib/format";
import { CATEGORIES } from "@/lib/event-category";
import { buildFilterHref, ACTIVE_FILTER_CLASS } from "@/lib/filter-href";
import { CategoryBadge } from "@/components/category-badge";
import { GameBadge } from "@/components/game-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; type?: string; page?: string }>;
}) {
  const t = await getTranslations("landing");
  const sp = await searchParams;
  const gameFilter = sp.game === "tcg" || sp.game === "vgc" ? sp.game : null;
  const typeFilter = sp.type ?? null;

  const allUpcoming = await getUpcoming();
  const upcoming = allUpcoming.filter((u) => {
    if (gameFilter && u.game !== gameFilter) return false;
    if (!typeFilter) return true;
    if (typeFilter === "session") return u.kind === "session";
    return u.kind === "event" && u.category === typeFilter;
  });

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
                      game: g || undefined,
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
            <ul className="flex flex-col divide-y rounded-lg border">
              {pageItems.map((u) => (
                <li key={u.href}>
                  <Link
                    href={u.href}
                    className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/50"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{u.name}</span>
                        <GameBadge game={u.game} />
                        {formatLabel(u.format) && (
                          <Badge variant="outline">{formatLabel(u.format)}</Badge>
                        )}
                        <CategoryBadge category={u.category} />
                        {u.kind === "session" && (
                          <Badge variant="outline">{t("session")}</Badge>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                        {u.subtitle && u.subtitle !== u.name && (
                          <span className="font-medium">{u.subtitle}</span>
                        )}
                        {formatDateTime(u.startsAt) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(u.startsAt)}
                          </span>
                        )}
                        {u.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {u.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5" />
                          {formatCost(u.cost)}
                        </span>
                      </span>
                    </span>
                  </Link>
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
