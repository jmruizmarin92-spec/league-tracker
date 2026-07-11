import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listActiveLeagues } from "@/lib/leagues";
import { getUpcoming } from "@/lib/agenda";
import { formatDateTime, formatCost } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const t = await getTranslations("landing");
  const [leagues, upcoming] = await Promise.all([
    listActiveLeagues(),
    getUpcoming(),
  ]);

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
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {upcoming.map((u) => (
              <li key={u.href}>
                <Link
                  href={u.href}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/50"
                >
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {u.name}
                      <Badge variant="secondary">{u.game.toUpperCase()}</Badge>
                      <Badge variant="outline">
                        {u.kind === "session" ? t("session") : t("event")}
                      </Badge>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {[
                        formatDateTime(u.startsAt),
                        u.subtitle,
                        u.location,
                        formatCost(u.cost),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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
                        <Badge variant="secondary">{l.game.toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    {l.description && (
                      <CardContent className="text-sm text-muted-foreground">
                        {l.description}
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
