import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getEventBySlug,
  isEventAdmin,
  listRegistrations,
  getMyRegistration,
  getEventLists,
} from "@/lib/events";
import { getUser } from "@/lib/auth";
import { pairingName } from "@/lib/player-name";
import { formatDateTime, formatCost } from "@/lib/format";
import {
  adminRemoveRegistrationAction,
  setEventStatusAction,
} from "@/app/actions/events";
import { EventRegister } from "@/components/event-register";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations("event");
  const [admin, regs, myReg, user] = await Promise.all([
    isEventAdmin(event.id),
    listRegistrations(event.id),
    getMyRegistration(event.id),
    getUser(),
  ]);
  const lists = admin ? await getEventLists(event.id) : new Map();

  const registered = regs.filter((r) => r.status === "registered");
  const waitlisted = regs.filter((r) => r.status === "waitlisted");
  const isTcg = event.game === "tcg";

  const meta = [
    formatDateTime(event.starts_at),
    event.location,
    formatCost(event.cost),
    event.capacity ? `${t("capacity")}: ${event.capacity}` : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("allEvents")}
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
          <Badge variant="secondary">{event.game.toUpperCase()}</Badge>
          <Badge variant={event.status === "open" ? "default" : "secondary"}>
            {t(`status_${event.status}`)}
          </Badge>
        </div>
        {meta.length > 0 && (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        )}
        {event.description && <p className="text-sm">{event.description}</p>}
        {event.external_url && (
          <Button asChild variant="outline" className="w-fit">
            <a href={event.external_url} target="_blank" rel="noopener noreferrer">
              {t("externalLink")}
            </a>
          </Button>
        )}
      </div>

      {event.prizes && (
        <Card>
          <CardHeader>
            <CardTitle>{t("prizes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{event.prizes}</p>
          </CardContent>
        </Card>
      )}

      {/* Registration + list */}
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("registration")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EventRegister
              slug={slug}
              eventId={event.id}
              isOpen={event.status === "open"}
              listRequired={event.list_required}
              myReg={
                myReg
                  ? { status: myReg.status, content: myReg.content, url: myReg.url }
                  : null
              }
              labels={{
                registeredIn: t("registeredIn"),
                waitlisted: t("waitlisted"),
                listLabel: isTcg ? t("listLabelTcg") : t("listLabelVgc"),
                listPlaceholder: isTcg
                  ? t("listPlaceholderTcg")
                  : t("listPlaceholderVgc"),
                urlLabel: t("urlLabel"),
                urlPlaceholder: t("urlPlaceholder"),
                listRequiredNote: t("listRequiredNote"),
                register: t("register"),
                save: t("saveList"),
                saved: t("saved"),
                unregister: t("unregister"),
                closed: t("closed"),
                privateNote: t("privateNote"),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("signInToRegister")}</p>
      )}

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("participants")} ({registered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {registered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noParticipants")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {registered.map((r) => {
                const list = lists.get(r.player_id);
                return (
                  <li key={r.player_id} className="flex flex-col gap-1 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {pairingName(r)}
                        {r.has_list && (
                          <Badge variant="outline">{t("listSubmitted")}</Badge>
                        )}
                      </span>
                      {admin && (
                        <form action={adminRemoveRegistrationAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="event_id" value={event.id} />
                          <input type="hidden" name="player_id" value={r.player_id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {t("remove")}
                          </Button>
                        </form>
                      )}
                    </div>
                    {admin && list && (list.content || list.url) && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">
                          {t("viewList")}
                        </summary>
                        {list.content && (
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">
                            {list.content}
                          </pre>
                        )}
                        {list.url && (
                          <a
                            href={list.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            {list.url}
                          </a>
                        )}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {waitlisted.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("waitlist")} ({waitlisted.length})
              </span>
              <ul className="flex flex-col divide-y">
                {waitlisted.map((r) => (
                  <li key={r.player_id} className="flex items-center justify-between gap-3 py-2">
                    <span>{pairingName(r)}</span>
                    {admin && (
                      <form action={adminRemoveRegistrationAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="player_id" value={r.player_id} />
                        <Button type="submit" variant="ghost" size="sm">
                          {t("remove")}
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin status */}
      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("adminTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("statusLabel")}</span>
            <div className="flex gap-2">
              {(["open", "closed", "complete"] as const).map((s) => (
                <form key={s} action={setEventStatusAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="status" value={s} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={event.status === s ? "default" : "outline"}
                  >
                    {t(`status_${s}`)}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
