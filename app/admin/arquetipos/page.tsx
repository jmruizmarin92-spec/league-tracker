import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listCustoms, type Custom } from "@/lib/archetypes";
import type { Game } from "@/lib/leagues";
import {
  deleteCustomArchetypeAction,
  toggleCustomArchetypeAction,
} from "@/app/actions/archetypes";
import { CustomArchetypeForm } from "@/components/custom-archetype-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ArchetypesAdminPage() {
  await requireAdmin();
  const t = await getTranslations("archetypesAdmin");

  const all = await listCustoms();
  const byGame: Record<Game, Custom[]> = {
    tcg: all.filter((c) => c.game === "tcg"),
    vgc: all.filter((c) => c.game === "vgc"),
  };

  const section = (game: Game) => (
    <Card key={game}>
      <CardHeader>
        <CardTitle>{game.toUpperCase()}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {byGame[game].length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {byGame[game].map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {c.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon_url} alt="" className="h-6 w-6 shrink-0" />
                  )}
                  <span className="truncate">{c.name}</span>
                  {!c.active && (
                    <Badge variant="secondary">{t("inactive")}</Badge>
                  )}
                </span>
                <div className="flex shrink-0 gap-2">
                  <form action={toggleCustomArchetypeAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={String(c.active)} />
                    <Button type="submit" variant="ghost" size="sm">
                      {c.active ? t("hide") : t("show")}
                    </Button>
                  </form>
                  <form action={deleteCustomArchetypeAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="outline" size="sm">
                      {t("delete")}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CustomArchetypeForm
          game={game}
          labels={{
            name: t("fieldName"),
            iconUrl: t("fieldIconUrl"),
            cta: t("add"),
          }}
        />
      </CardContent>
    </Card>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>
      {section("tcg")}
      {section("vgc")}
    </main>
  );
}
