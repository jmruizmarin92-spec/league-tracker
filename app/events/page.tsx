import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listEvents } from "@/lib/events";
import { getProfile } from "@/lib/auth";
import { formatDateTime, formatCost } from "@/lib/format";
import { CreateEventForm } from "@/components/create-event-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT = {
  open: "default",
  closed: "secondary",
  complete: "outline",
} as const;

export default async function EventsPage() {
  const t = await getTranslations("events");
  const [events, profile] = await Promise.all([listEvents(), getProfile()]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {events.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.slug}`} className="block">
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{e.name}</CardTitle>
                      <Badge variant="secondary">{e.game.toUpperCase()}</Badge>
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
