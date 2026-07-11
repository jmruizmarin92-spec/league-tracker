import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getSession,
  listParticipants,
  getMyParticipation,
  type SessionParticipant,
} from "@/lib/sessions";
import { isLeagueAdmin } from "@/lib/leagues";
import { getUser } from "@/lib/auth";
import { listPlayers, getPlayersByIds } from "@/lib/players";
import { pairingName } from "@/lib/player-name";
import { formatDateTime, formatCost } from "@/lib/format";
import { resolveArchetypes, listCustoms, type ArchetypeChip } from "@/lib/archetypes";
import { getRounds, getSessionMatches } from "@/lib/rounds";
import { computeStandings, type MatchInput } from "@/lib/scoring";
import {
  joinSessionAction,
  leaveSessionAction,
  adminRemoveParticipantAction,
  setSessionStatusAction,
  createSessionPlayerAction,
} from "@/app/actions/sessions";
import { generateRoundAction } from "@/app/actions/rounds";
import { AddParticipantForm } from "@/components/add-participant-form";
import { ArchetypePicker } from "@/components/archetype-picker";
import { StandingsTable } from "@/components/standings-table";
import { RoundsTabs, type RoundView } from "@/components/rounds-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ArchetypeIcons({
  p,
  chips,
  canSee,
}: {
  p: SessionParticipant;
  chips: Map<string, ArchetypeChip>;
  canSee: boolean;
}) {
  if (!canSee) return null;
  const keys = [p.archetype1, p.archetype2].filter(Boolean) as string[];
  const resolved = keys.map((k) => chips.get(k)).filter(Boolean) as ArchetypeChip[];
  if (resolved.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {resolved.map((c) =>
        c.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c.key} src={c.icon} alt={c.name} title={c.name} className="h-6 w-6" />
        ) : (
          <span
            key={c.key}
            title={c.name}
            className="rounded bg-muted px-1.5 py-0.5 text-xs"
          >
            {c.name}
          </span>
        ),
      )}
    </span>
  );
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const t = await getTranslations("session");
  const game = session.league?.game;

  const [admin, participants, myPart, user, customsAll] = await Promise.all([
    session.league ? isLeagueAdmin(session.league.id) : Promise.resolve(false),
    listParticipants(id),
    getMyParticipation(id),
    getUser(),
    game ? listCustoms(game) : Promise.resolve([]),
  ]);

  const chips = await resolveArchetypes(
    participants.flatMap((p) => [p.archetype1, p.archetype2]),
  );
  const activeCustoms = customsAll
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, icon_url: c.icon_url }));

  const registered = participants.filter((p) => p.status === "registered");
  const waitlisted = participants.filter((p) => p.status === "waitlisted");
  const isComplete = session.status === "complete";

  // Rounds, matches, standings.
  const [rounds, matches] = await Promise.all([
    getRounds(id),
    getSessionMatches(id),
  ]);
  const standingIds = [
    ...new Set([
      ...registered.map((p) => p.player_id),
      ...matches.flatMap(
        (m) => [m.player1_id, m.player2_id].filter(Boolean) as string[],
      ),
    ]),
  ];
  const standings = computeStandings(
    standingIds,
    matches.map<MatchInput>((m) => ({
      player1: m.player1_id,
      player2: m.player2_id,
      result: m.result,
    })),
  );
  const nameMap = await getPlayersByIds(standingIds);
  const displayName = (pid: string) => {
    const p = nameMap.get(pid);
    return p ? pairingName(p) : "—";
  };
  const standingsNames = new Map(standingIds.map((pid) => [pid, displayName(pid)]));
  const myPlayerId = participants.find((p) => p.is_me)?.player_id ?? null;
  const hasPending = matches.some((m) => m.result === "pending");
  const lastRoundNumber = rounds.at(-1)?.number ?? 0;
  const nextRoundNumber = lastRoundNumber + 1;

  const roundViews: RoundView[] = rounds.map((r) => ({
    id: r.id,
    number: r.number,
    isLast: r.number === lastRoundNumber,
    matches: matches
      .filter((m) => m.round_id === r.id)
      .map((m) => {
        const mine =
          myPlayerId != null &&
          (m.player1_id === myPlayerId || m.player2_id === myPlayerId);
        return {
          id: m.id,
          p1Name: displayName(m.player1_id),
          p2Name: m.player2_id ? displayName(m.player2_id) : null,
          result: m.result,
          canReport: admin || mine,
          isMine: mine,
        };
      }),
  }));

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

  const renderRow = (p: SessionParticipant) => (
    <li
      key={p.player_id}
      className="flex items-center justify-between gap-3 py-2"
    >
      <span className="flex items-center gap-2">
        <span className={p.is_me ? "font-medium" : undefined}>
          {pairingName(p)}
        </span>
        <ArchetypeIcons
          p={p}
          chips={chips}
          canSee={p.archetype_public || p.is_me || admin}
        />
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
  );

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
          <Badge variant={session.status === "active" ? "default" : "secondary"}>
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
          {myPart ? (
            <>
              <Badge
                variant={myPart.status === "registered" ? "default" : "secondary"}
              >
                {myPart.status === "registered"
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

      {/* Standings */}
      {standings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("standings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <StandingsTable
              rows={standings}
              names={standingsNames}
              labels={{
                rank: t("rank"),
                player: t("player"),
                points: t("points"),
                record: t("record"),
                buchholz: t("buchholz"),
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Rounds */}
      {(rounds.length > 0 || (admin && !isComplete)) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("rounds")}</CardTitle>
              {admin && !isComplete && (
                <form action={generateRoundAction}>
                  <input type="hidden" name="session_id" value={id} />
                  <Button type="submit" size="sm" disabled={hasPending}>
                    {t("generateRound", { n: nextRoundNumber })}
                  </Button>
                </form>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {hasPending && admin && (
              <p className="text-xs text-muted-foreground">
                {t("pendingBlocksNext")}
              </p>
            )}
            {rounds.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRounds")}</p>
            ) : (
              <RoundsTabs
                sessionId={id}
                admin={admin}
                rounds={roundViews}
                labels={{
                  roundWord: t("roundWord"),
                  deleteRound: t("deleteRound"),
                  bye: t("bye"),
                  draw: t("draw"),
                  pending: t("pending"),
                  winPrefix: t("winPrefix"),
                  mine: t("mine"),
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* My archetypes */}
      {myPart && (
        <Card>
          <CardHeader>
            <CardTitle>{t("myArchetypes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ArchetypePicker
              sessionId={id}
              customs={activeCustoms}
              initial={{
                a1: myPart.archetype1 ?? "",
                a2: myPart.archetype2 ?? "",
                isPublic: myPart.archetype_public,
              }}
              labels={{
                title: t("myArchetypes"),
                hint: t("archHint"),
                slot1: t("arch1"),
                slot2: t("arch2"),
                placeholder: t("archPlaceholder"),
                search: t("archSearch"),
                clear: t("archClear"),
                publicLabel: t("archPublic"),
                save: t("archSave"),
                saved: t("archSaved"),
              }}
            />
          </CardContent>
        </Card>
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
            <ul className="flex flex-col divide-y">{registered.map(renderRow)}</ul>
          )}

          {waitlisted.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("waitlist")} ({waitlisted.length})
              </span>
              <ul className="flex flex-col divide-y">
                {waitlisted.map(renderRow)}
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
                  <span className="text-sm font-medium">{t("createPlayer")}</span>
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
