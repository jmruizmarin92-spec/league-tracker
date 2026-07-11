import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listLeagues, formatLabel } from "@/lib/leagues";
import { getProfile } from "@/lib/auth";
import { formatMonthRange } from "@/lib/format";
import { CreateLeagueForm } from "@/components/create-league-form";
import { GameBadge } from "@/components/game-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LeaguesPage() {
  const t = await getTranslations("leagues");
  const [leagues, profile] = await Promise.all([listLeagues(), getProfile()]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {leagues.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
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
                  {([formatLabel(l.format), l.subtitle].some(Boolean) ||
                    formatMonthRange(l.starts_month, l.ends_month)) && (
                    <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {[formatLabel(l.format), l.subtitle].some(Boolean) && (
                        <p>
                          {[formatLabel(l.format), l.subtitle]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {formatMonthRange(l.starts_month, l.ends_month) && (
                        <p>{formatMonthRange(l.starts_month, l.ends_month)}</p>
                      )}
                    </CardContent>
                  )}
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
            <CreateLeagueForm
              labels={{
                name: t("fieldName"),
                game: t("fieldGame"),
                gamePlaceholder: t("gamePlaceholder"),
                format: t("fieldFormat"),
                formatPlaceholder: t("formatPlaceholder"),
                description: t("fieldDescription"),
                startMonth: t("fieldStartMonth"),
                endMonth: t("fieldEndMonth"),
                cta: t("createCta"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
