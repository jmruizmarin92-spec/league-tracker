import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { CreateEventForm } from "@/components/create-event-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminEventsPage() {
  await requireAdmin();
  const t = await getTranslations("events");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("createTitle")}</h1>

      <Card>
        <CardContent className="pt-6">
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
    </main>
  );
}
