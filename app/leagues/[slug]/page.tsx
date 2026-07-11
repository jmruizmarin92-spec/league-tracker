import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLeagueBySlug, isLeagueAdmin, formatLabel } from "@/lib/leagues";
import { listSessions } from "@/lib/sessions";
import { formatDateTime, formatCost, formatMonthRange } from "@/lib/format";
import { CATEGORIES } from "@/lib/event-category";
import { CreateSessionForm } from "@/components/create-session-form";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT = {
  setup: "secondary",
  active: "default",
  complete: "outline",
} as const;

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const t = await getTranslations("league");
  const sp = await searchParams;
  const categoryFilter = sp.category ?? null;

  const [admin, allSessions] = await Promise.all([
    isLeagueAdmin(league.id),
    listSessions(league.id),
  ]);
  const sessions = allSessions.filter(
    (s) => !categoryFilter || s.category === categoryFilter,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {league.name}
            </h1>
            <Badge variant="secondary">{league.game.toUpperCase()}</Badge>
            {formatLabel(league.format) && (
              <Badge variant="outline">{formatLabel(league.format)}</Badge>
            )}
            {league.archived_at && (
              <Badge variant="outline">{t("archivedBadge")}</Badge>
            )}
          </div>
          {league.description && (
            <p className="text-muted-foreground">{league.description}</p>
          )}
          {formatMonthRange(league.starts_month, league.ends_month) && (
            <p className="text-sm text-muted-foreground">
              {formatMonthRange(league.starts_month, league.ends_month)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/leagues/${slug}/clasificacion`}>
              {t("standingsLink")}
            </Link>
          </Button>
          {admin && (
            <Button asChild variant="outline">
              <Link href={`/leagues/${slug}/admin`}>{t("manage")}</Link>
            </Button>
          )}
        </div>
      </div>

      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("createSession")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateSessionForm
              leagueId={league.id}
              slug={slug}
              locations={league.locations}
              defaultLocation={league.default_location}
              labels={{
                name: t("sName"),
                startsAt: t("sStartsAt"),
                location: t("sLocation"),
                locationPlaceholder: t("sLocationPlaceholder"),
                cost: t("sCost"),
                capacity: t("sCapacity"),
                capacityHint: t("sCapacityHint"),
                category: t("sCategory"),
                categoryPlaceholder: t("categoryPlaceholder"),
                categoryNone: t("categoryNone"),
                cta: t("sCreate"),
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {allSessions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant={!categoryFilter ? "default" : "outline"}>
                <Link href={`/leagues/${slug}`}>{t("filterAllCategories")}</Link>
              </Button>
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                  <Button
                    key={c.value}
                    asChild
                    size="sm"
                    variant={categoryFilter === c.value ? "default" : "outline"}
                  >
                    <Link href={`/leagues/${slug}?category=${c.value}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          )}
          {sessions.length === 0 ? (
            <p className="text-muted-foreground">
              {allSessions.length === 0 ? t("noSessions") : t("noMatches")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">
                          {s.name ?? formatDateTime(s.starts_at) ?? t("session")}
                        </span>
                        <CategoryBadge category={s.category} />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {[formatDateTime(s.starts_at), s.location, formatCost(s.cost)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <Badge variant={STATUS_VARIANT[s.status]}>
                      {t(`status_${s.status}`)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
