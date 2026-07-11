import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listLeagues } from "@/lib/leagues";
import { getProfile } from "@/lib/auth";
import { CreateLeagueForm } from "@/components/create-league-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function LeaguesPage() {
  const t = await getTranslations("leagues");
  const [leagues, profile] = await Promise.all([listLeagues(), getProfile()]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

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
                description: t("fieldDescription"),
                cta: t("createCta"),
              }}
            />
          </CardContent>
        </Card>
      )}

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
    </main>
  );
}
