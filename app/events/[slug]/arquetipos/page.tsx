import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEventBySlug } from "@/lib/events";
import { computeEventArchetypeStats } from "@/lib/archetype-standings";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ArchetypeStatsTable } from "@/components/archetype-stats-table";
import { Card, CardContent } from "@/components/ui/card";

export default async function EventArchetypeStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations("eventArchetypes");
  const tb = await getTranslations("breadcrumbs");
  const rows = await computeEventArchetypeStats(event.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Breadcrumbs
          items={[
            { label: tb("home"), href: "/" },
            { label: event.name, href: `/events/${slug}` },
            { label: t("title") },
          ]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ArchetypeStatsTable
            rows={rows}
            showRecord={false}
            labels={{
              empty: t("empty"),
              archetype: t("archetype"),
              players: t("players"),
              percentage: t("percentage"),
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
