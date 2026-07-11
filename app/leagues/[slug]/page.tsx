import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLeagueBySlug, isLeagueAdmin } from "@/lib/leagues";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const t = await getTranslations("league");
  const admin = await isLeagueAdmin(league.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {league.name}
            </h1>
            <Badge variant="secondary">{league.game.toUpperCase()}</Badge>
          </div>
          {league.description && (
            <p className="text-muted-foreground">{league.description}</p>
          )}
        </div>
        {admin && (
          <Button asChild variant="outline">
            <Link href={`/leagues/${slug}/admin`}>{t("manage")}</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          {t("sessionsSoon")}
        </CardContent>
      </Card>
    </main>
  );
}
