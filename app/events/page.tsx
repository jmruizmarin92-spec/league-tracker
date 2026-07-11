import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listEvents } from "@/lib/events";
import { getProfile } from "@/lib/auth";
import { formatDateTime, formatCost } from "@/lib/format";
import { CATEGORIES } from "@/lib/event-category";
import { buildFilterHref } from "@/lib/filter-href";
import { CreateEventForm } from "@/components/create-event-form";
import { CategoryBadge } from "@/components/category-badge";
import { GameBadge } from "@/components/game-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT = {
  open: "default",
  closed: "secondary",
  complete: "outline",
} as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; category?: string }>;
}) {
  const t = await getTranslations("events");
  const sp = await searchParams;
  const gameFilter = sp.game === "tcg" || sp.game === "vgc" ? sp.game : null;
  const categoryFilter = sp.category ?? null;

  const [allEvents, profile] = await Promise.all([listEvents(), getProfile()]);
  const events = allEvents.filter(
    (e) =>
      (!gameFilter || e.game === gameFilter) &&
      (!categoryFilter || e.category === categoryFilter),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

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
              variant={(gameFilter ?? "") === g ? "secondary" : "outline"}
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
            variant={!categoryFilter ? "secondary" : "outline"}
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
                variant={categoryFilter === c.value ? "secondary" : "outline"}
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

      {events.length === 0 ? (
        <p className="text-muted-foreground">
          {allEvents.length === 0 ? t("empty") : t("noMatches")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.slug}`} className="block">
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="truncate">{e.name}</CardTitle>
                      <div className="flex flex-wrap gap-1">
                        <GameBadge game={e.game} />
                        <CategoryBadge category={e.category} />
                        {e.subtitle && (
                          <Badge variant="outline">{e.subtitle}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <span>
                      {[formatDateTime(e.starts_at), e.location, formatCost(e.cost)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <Badge variant={STATUS_VARIANT[e.status]} className="w-fit">
                      {t(`status_${e.status}`)}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {profile?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateEventForm
              labels={{
                name: t("fName"),
                subtitle: t("fSubtitle"),
                subtitleHint: t("subtitleHint"),
                category: t("fCategory"),
                categoryPlaceholder: t("categoryPlaceholder"),
                categoryNone: t("categoryNone"),
                game: t("fGame"),
                gamePlaceholder: t("gamePlaceholder"),
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
                cta: t("createCta"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
