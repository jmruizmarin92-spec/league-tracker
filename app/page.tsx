import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Calendar, MapPin, Coins } from "lucide-react";
import { listActiveLeagues, formatLabel } from "@/lib/leagues";
import { getUpcoming } from "@/lib/agenda";
import { formatDateTime, formatCost } from "@/lib/format";
import { CATEGORIES } from "@/lib/event-category";
import { buildFilterHref } from "@/lib/filter-href";
import { CategoryBadge } from "@/components/category-badge";
import { GameBadge } from "@/components/game-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; type?: string }>;
}) {
  const t = await getTranslations("landing");
  const sp = await searchParams;
  const gameFilter = sp.game === "tcg" || sp.game === "vgc" ? sp.game : null;
  const typeFilter = sp.type ?? null;

  const [leagues, allUpcoming] = await Promise.all([
    listActiveLeagues(),
    getUpcoming(),
  ]);
  const upcoming = allUpcoming.filter((u) => {
    if (gameFilter && u.game !== gameFilter) return false;
    if (!typeFilter) return true;
    if (typeFilter === "session") return u.kind === "session";
    return u.kind === "event" && u.category === typeFilter;
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Upcoming sessions + events */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("upcoming")}</h2>
          <Link
            href="/events"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("allEvents")}
          </Link>
        </div>

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
                  variant={(gameFilter ?? "") === g ? "default" : "outline"}
                >
                  <Link href={buildFilterHref("/", sp, { game: g || undefined })}>
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
                variant={!typeFilter ? "default" : "outline"}
              >
                <Link href={buildFilterHref("/", sp, { type: undefined })}>
                  {t("filterAllCategories")}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={typeFilter === "session" ? "default" : "outline"}
              >
                <Link href={buildFilterHref("/", sp, { type: "session" })}>
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
                    variant={typeFilter === c.value ? "default" : "outline"}
                  >
                    <Link href={buildFilterHref("/", sp, { type: c.value })}>
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
          <ul className="flex flex-col divide-y rounded-lg border">
            {upcoming.map((u) => (
              <li key={u.href}>
                <Link
                  href={u.href}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/50"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{u.name}</span>
                      <GameBadge game={u.game} />
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
        )}
      </section>

      {/* Active leagues */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("activeLeagues")}</h2>
          <Link
            href="/leagues"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("allLeagues")}
          </Link>
        </div>
        {leagues.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLeagues")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {leagues.map((l) => (
              <li key={l.id}>
                <Link href={`/leagues/${l.slug}`} className="block">
                  <Card className="h-full transition-colors hover:border-primary">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>{l.name}</CardTitle>
                        <GameBadge game={l.game} />
                      </div>
                    </CardHeader>
                    {[formatLabel(l.format), l.subtitle].some(Boolean) && (
                      <CardContent className="text-sm text-muted-foreground">
                        {[formatLabel(l.format), l.subtitle]
                          .filter(Boolean)
                          .join(" · ")}
                      </CardContent>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
