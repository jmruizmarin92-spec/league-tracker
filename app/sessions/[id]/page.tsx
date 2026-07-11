import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getSession,
  listParticipants,
  getMyParticipation,
} from "@/lib/sessions";
import { isLeagueAdmin } from "@/lib/leagues";
import { getUser } from "@/lib/auth";
import { listPlayers } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { formatDateTime, formatCost } from "@/lib/format";
import {
  joinSessionAction,
  leaveSessionAction,
  adminRemoveParticipantAction,
  setSessionStatusAction,
  createSessionPlayerAction,
} from "@/app/actions/sessions";
import { AddParticipantForm } from "@/components/add-participant-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const t = await getTranslations("session");
  const [admin, participants, myStatus, user] = await Promise.all([
    session.league ? isLeagueAdmin(session.league.id) : Promise.resolve(false),
    listParticipants(id),
    getMyParticipation(id),
    getUser(),
  ]);

  const registered = participants.filter((p) => p.status === "registered");
  const waitlisted = participants.filter((p) => p.status === "waitlisted");
  const isComplete = session.status === "complete";

  const participantIds = new Set(participants.map((p) => p.player_id));
  const addable = admin
    ? (await listPlayers())
        .filter((p) => !participantIds.has(p.id))
        .map((p) => ({ id: p.id, label: pairingName(p) }))
    : [];

  const meta = [
    formatDateTime(session.starts_at),
    session.location,
    formatCost(session.cost),
    session.capacity ? `${t("capacity")}: ${session.capacity}` : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        {session.league && (
          <Link
            href={`/leagues/${session.league.slug}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {session.league.name}
          </Link>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {session.name ?? formatDateTime(session.starts_at) ?? t("session")}
          </h1>
          <Badge
            variant={session.status === "active" ? "default" : "secondary"}
          >
            {t(`status_${session.status}`)}
          </Badge>
        </div>
        {meta.length > 0 && (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        )}
      </div>

      {/* Self join / leave */}
      {user && !isComplete && (
        <div className="flex items-center gap-3">
          {myStatus ? (
            <>
              <Badge variant={myStatus === "registered" ? "default" : "secondary"}>
                {myStatus === "registered"
                  ? t("youAreIn")
                  : t("youAreWaitlisted")}
              </Badge>
              <form action={leaveSessionAction}>
                <input type="hidden" name="session_id" value={id} />
                <Button type="submit" variant="outline" size="sm">
                  {t("leave")}
                </Button>
              </form>
            </>
          ) : (
            <form action={joinSessionAction}>
              <input type="hidden" name="session_id" value={id} />
              <Button type="submit">{t("join")}</Button>
            </form>
          )}
        </div>
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
              {registered.map((p) => (
                <li
                  key={p.player_id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className={p.is_me ? "font-medium" : undefined}>
                    {pairingName(p)}
                  </span>
                  {admin && (
                    <form action={adminRemoveParticipantAction}>
                      <input type="hidden" name="session_id" value={id} />
                      <input type="hidden" name="player_id" value={p.player_id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t("remove")}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {waitlisted.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("waitlist")} ({waitlisted.length})
              </span>
              <ul className="flex flex-col divide-y">
                {waitlisted.map((p) => (
                  <li
                    key={p.player_id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className={p.is_me ? "font-medium" : undefined}>
                      {pairingName(p)}
                    </span>
                    {admin && (
                      <form action={adminRemoveParticipantAction}>
                        <input type="hidden" name="session_id" value={id} />
                        <input
                          type="hidden"
                          name="player_id"
                          value={p.player_id}
                        />
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

      {/* Admin controls */}
      {admin && (
        <Card>
          <CardHeader>
            <CardTitle>{t("adminTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {isComplete ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {t("completeNoAdd")}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("addParticipant")}
                  </span>
                  <AddParticipantForm
                    sessionId={id}
                    players={addable}
                    labels={{ placeholder: t("choosePlayer"), cta: t("add") }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("createPlayer")}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {t("createPlayerHint")}
                  </p>
                  <form
                    action={createSessionPlayerAction}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <input type="hidden" name="session_id" value={id} />
                    <Input
                      name="name"
                      maxLength={60}
                      placeholder={t("newPlayerPlaceholder")}
                      className="sm:flex-1"
                    />
                    <Button type="submit" variant="secondary">
                      {t("createPlayerCta")}
                    </Button>
                  </form>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("statusLabel")}</span>
              <div className="flex gap-2">
                {(["setup", "active", "complete"] as const).map((s) => (
                  <form key={s} action={setSessionStatusAction}>
                    <input type="hidden" name="session_id" value={id} />
                    <input type="hidden" name="status" value={s} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={session.status === s ? "default" : "outline"}
                    >
                      {t(`status_${s}`)}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
