import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getSessionBySlug,
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
import { recommendedRoundCount } from "@/lib/pairing";
import {
  joinSessionAction,
  leaveSessionAction,
  adminRemoveParticipantAction,
  setSessionStatusAction,
  createSessionPlayerAction,
  deleteSessionAction,
  setMyArchetypesAction,
  adminSetParticipantArchetypesAction,
  setArchetypeVisibilityAction,
  adminSetCheckedInAction,
} from "@/app/actions/sessions";
import { generateRoundAction } from "@/app/actions/rounds";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddParticipantForm } from "@/components/add-participant-form";
import { EditSessionForm } from "@/components/edit-session-form";
import { ArchetypePicker } from "@/components/archetype-picker";
import {
  ParticipantsList,
  type ParticipantRowData,
} from "@/components/participants-list";
import { StandingsTable } from "@/components/standings-table";
import { RoundsTabs, type RoundView } from "@/components/rounds-tabs";
import { SessionTabs, type SessionTab } from "@/components/session-tabs";
import { MyMatchCard, type MyMatch } from "@/components/my-match-card";
import { CopyPokemonIds } from "@/components/copy-pokemon-ids";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; sessionSlug: string }>;
}) {
  const { slug: leagueSlug, sessionSlug } = await params;
  const session = await getSessionBySlug(leagueSlug, sessionSlug);
  if (!session) notFound();
  const id = session.id;

  const t = await getTranslations("session");
  const tb = await getTranslations("breadcrumbs");
  const game = session.league?.game;
  const sessionLabel =
    session.name ?? formatDateTime(session.starts_at) ?? t("session");

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

  // Once the session is complete, a player can no longer edit an archetype
  // they already recorded — only add one if they never set anything (mirrors
  // the set_participant_archetypes RPC's own lock, 0034_lock_archetypes.sql).
  // Admin edits stay unrestricted (the roster's own picker below).
  const myArchLocked =
    isComplete && !!myPart && (!!myPart.archetype1 || !!myPart.archetype2);
  const myChips = myPart
    ? [myPart.archetype1, myPart.archetype2]
        .filter((k): k is string => !!k)
        .map((k) => chips.get(k))
        .filter((c): c is ArchetypeChip => !!c)
    : [];

  // Pokémon IDs of every participant (registered + waitlist) for tournament
  // upload; players without an ID on their profile are omitted from the copy
  // list but surfaced separately so admins can chase them down.
  const pokemonIds = participants
    .map((p) => p.pokemon_id?.trim())
    .filter((v): v is string => !!v);
  const missingPokemonIds = participants
    .filter((p) => !p.pokemon_id?.trim())
    .map((p) => ({ id: p.player_id, name: pairingName(p) }));

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

  // Public archetypes to show in the standings, keyed by player.
  const publicArch = new Map<string, ArchetypeChip[]>();
  for (const p of participants) {
    if (!p.archetype_public) continue;
    const arr = [p.archetype1, p.archetype2]
      .filter((k): k is string => !!k)
      .map((k) => chips.get(k))
      .filter((c): c is ArchetypeChip => !!c);
    if (arr.length > 0) publicArch.set(p.player_id, arr);
  }
  const myPlayerId = participants.find((p) => p.is_me)?.player_id ?? null;
  const hasPending = matches.some((m) => m.result === "pending");
  const lastRoundNumber = rounds.at(-1)?.number ?? 0;
  const nextRoundNumber = lastRoundNumber + 1;
  const recommendedRounds = recommendedRoundCount(registered.length);

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
          table: m.table_number,
        };
      }),
    timer: {
      durationSeconds: r.timer_duration_seconds,
      endsAt: r.timer_ends_at,
      remainingSeconds: r.timer_remaining_seconds,
    },
  }));

  // The logged-in player's own match in the latest round, surfaced at the very
  // top of the page so they can report it without scrolling.
  const latestRound = rounds.at(-1);
  const myMatchRow =
    myPlayerId != null && latestRound
      ? matches.find(
          (m) =>
            m.round_id === latestRound.id &&
            (m.player1_id === myPlayerId || m.player2_id === myPlayerId),
        )
      : undefined;
  const myMatch: MyMatch | null =
    myMatchRow && latestRound
      ? {
          id: myMatchRow.id,
          roundNumber: latestRound.number,
          table: myMatchRow.table_number,
          iAmP1: myMatchRow.player1_id === myPlayerId,
          opponentName: (() => {
            const oppId =
              myMatchRow.player1_id === myPlayerId
                ? myMatchRow.player2_id
                : myMatchRow.player1_id;
            return oppId ? displayName(oppId) : null;
          })(),
          result: myMatchRow.result,
        }
      : null;

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

  const toRow = (p: SessionParticipant): ParticipantRowData => ({
    playerId: p.player_id,
    checkedIn: p.checked_in,
    name: (
      <span className={p.is_me ? "font-medium" : undefined}>
        {pairingName(p)}
      </span>
    ),
    chips: [p.archetype1, p.archetype2]
      .filter((k): k is string => !!k)
      .map((k) => chips.get(k))
      .filter((c): c is ArchetypeChip => !!c),
    initial: {
      a1: p.archetype1 ?? "",
      a2: p.archetype2 ?? "",
      isPublic: p.archetype_public,
    },
    actions: (
      <form action={adminRemoveParticipantAction}>
        <input type="hidden" name="session_id" value={id} />
        <input type="hidden" name="player_id" value={p.player_id} />
        <Button type="submit" variant="ghost" size="sm">
          {t("remove")}
        </Button>
      </form>
    ),
  });

  const rosterProps = {
    contextId: id,
    customs: activeCustoms,
    action: setMyArchetypesAction,
    adminAction: adminSetParticipantArchetypesAction,
    setCheckedInAction: adminSetCheckedInAction,
    labels: {
      checkedIn: t("checkedIn"),
      edit: t("archEditCta"),
      close: t("archEditClose"),
      none: t("archNone"),
      title: t("myArchetypes"),
      hint: t("archHint"),
      slot1: t("arch1"),
      slot2: t("arch2"),
      placeholder: t("archPlaceholder"),
      search: t("archSearch"),
      clear: t("archClear"),
      noResults: t("archNoResults"),
      publicLabel: t("archPublic"),
      save: t("archSave"),
      saved: t("archSaved"),
    },
  };

  // Everything below the header lives in tabs so the admin view stops being one
  // long scroll. All panels are rendered server-side in this pass — the tabs
  // only pick what's visible. Panels drop their own card title: the tab label is
  // the heading, so repeating it inside would be doubled chrome.
  const tabs: SessionTab[] = [];

  if (rounds.length > 0 || (admin && !isComplete)) {
    tabs.push({
      value: "rounds",
      label: t("rounds"),
      content: (
        <Card>
          <CardContent className="flex flex-col gap-5">
            {admin && !isComplete && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <form action={generateRoundAction}>
                  <input type="hidden" name="session_id" value={id} />
                  <Button type="submit" size="sm" disabled={hasPending}>
                    {t("generateRound", { n: nextRoundNumber })}
                  </Button>
                </form>
                {recommendedRounds > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t("recommendedRounds", { n: recommendedRounds })}
                  </span>
                )}
              </div>
            )}
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
                  loss: t("loss"),
                  draw: t("draw"),
                  pending: t("pending"),
                  winPrefix: t("winPrefix"),
                  mine: t("mine"),
                  vs: t("vs"),
                  tableLabel: t("tableLabel"),
                  timerMinutesPlaceholder: t("timerMinutesPlaceholder"),
                  timerStart: t("timerStart"),
                  timerPause: t("timerPause"),
                  timerResume: t("timerResume"),
                  timerReset: t("timerReset"),
                  timerPaused: t("timerPaused"),
                  timerTimeUp: t("timerTimeUp"),
                  timerAlertsEnable: t("timerAlertsEnable"),
                  timerAlertsDisable: t("timerAlertsDisable"),
                  timerAlertsBlocked: t("timerAlertsBlocked"),
                  timerNotifyBody: t("timerNotifyBody"),
                }}
              />
            )}
          </CardContent>
        </Card>
      ),
    });
  }

  if (standings.length > 0) {
    tabs.push({
      value: "standings",
      label: t("standings"),
      content: (
        <Card>
          <CardContent>
            <StandingsTable
              rows={standings}
              names={standingsNames}
              archetypes={publicArch}
              labels={{
                rank: t("rank"),
                player: t("player"),
                points: t("points"),
                record: t("record"),
                oppWinRate: t("oppWinRate"),
              }}
            />
          </CardContent>
        </Card>
      ),
    });
  }

  // Participants are admin-only; standings and rounds already show the roster
  // to everyone else.
  if (admin) {
    tabs.push({
      value: "participants",
      label: `${t("participants")} (${registered.length})`,
      content: (
        <Card>
          <CardContent className="flex flex-col gap-4">
            {registered.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noParticipants")}</p>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  {t("checkedInCount", {
                    n: registered.filter((p) => p.checked_in).length,
                    total: registered.length,
                  })}
                </span>
                <ParticipantsList
                  {...rosterProps}
                  rows={registered.map(toRow)}
                  filterLabel={t("pendingOnly")}
                  emptyFilteredLabel={t("allCheckedIn")}
                />
              </>
            )}

            {waitlisted.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("waitlist")} ({waitlisted.length})
                </span>
                <ParticipantsList
                  {...rosterProps}
                  rows={waitlisted.map(toRow)}
                />
              </div>
            )}

            {participants.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <span className="text-sm font-medium">{t("pokemonIdsTitle")}</span>
                <CopyPokemonIds
                  ids={pokemonIds}
                  labels={{
                    copy: t("pokemonIdsCopy"),
                    copied: t("pokemonIdsCopied"),
                    empty: t("pokemonIdsEmpty"),
                  }}
                />
                {missingPokemonIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("pokemonIdsMissing", {
                      count: missingPokemonIds.length,
                    })}{" "}
                    {missingPokemonIds.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <Link
                          href={`/admin/players/${p.id}`}
                          className="text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ),
    });

    tabs.push({
      value: "manage",
      label: t("tabManage"),
      content: (
        <Card>
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
                    roundsStarted={lastRoundNumber > 0}
                    labels={{
                      placeholder: t("choosePlayer"),
                      cta: t("add"),
                      lateTitle: t("lateTitle"),
                      lateHint: t("lateHint"),
                      missedNone: t("lateMissedNone"),
                      missedLoss: t("lateMissedLoss"),
                      entryNext: t("lateEntryNext"),
                      entryCurrent: t("lateEntryCurrent"),
                      entryBye: t("lateEntryBye"),
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
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

            <div className="flex flex-col gap-2 border-t pt-4">
              <span className="text-sm font-medium">{t("editDetailsTitle")}</span>
              <EditSessionForm
                sessionId={id}
                locations={session.league?.locations ?? []}
                defaults={{
                  startsAt: session.starts_at,
                  location: session.location,
                  cost: session.cost,
                  capacity: session.capacity,
                }}
                labels={{
                  startsAt: t("sStartsAt"),
                  location: t("sLocation"),
                  locationPlaceholder: t("sLocationPlaceholder"),
                  cost: t("sCost"),
                  capacity: t("sCapacity"),
                  capacityHint: t("sCapacityHint"),
                  save: t("save"),
                  saved: t("saved"),
                }}
              />
            </div>

            <div className="flex flex-col gap-2 border-t pt-4">
              <span className="text-sm font-medium">{t("statusLabel")}</span>
              <div className="flex flex-wrap gap-2">
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

            {session.league && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <span className="text-sm font-medium">{t("dangerZone")}</span>
                <form action={deleteSessionAction} className="w-fit">
                  <input type="hidden" name="session_id" value={id} />
                  <input
                    type="hidden"
                    name="league_slug"
                    value={session.league.slug}
                  />
                  <ConfirmDeleteButton confirmMessage={t("confirmDeleteSession")}>
                    {t("deleteSession")}
                  </ConfirmDeleteButton>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    });
  }

  // During setup an admin's job is check-in, not pairings — land them there.
  const initialTab =
    admin && session.status === "setup" ? "participants" : "rounds";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      {/* Players now read the round clock off their own match card, so the page
          has to pick up timer start/pause/reset without a manual reload. */}
      {!isComplete && <RealtimeRefresher sessionId={id} />}
      <div className="flex flex-col gap-2">
        <Breadcrumbs
          items={[
            { label: tb("home"), href: "/" },
            ...(session.league
              ? [{ label: session.league.name, href: `/leagues/${session.league.slug}` }]
              : []),
            { label: sessionLabel },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {sessionLabel}
          </h1>
          <Badge variant={session.status === "active" ? "default" : "secondary"}>
            {t(`status_${session.status}`)}
          </Badge>
        </div>
        {meta.length > 0 && (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        )}
        <Link
          href={`/leagues/${leagueSlug}/sessions/${sessionSlug}/display`}
          target="_blank"
          className="w-fit text-sm text-primary hover:underline"
        >
          {t("openDisplay")}
        </Link>
        {session.league && (
          <Link
            href={`/leagues/${session.league.slug}/clasificacion`}
            className="w-fit text-sm text-primary hover:underline"
          >
            {t("leagueStandingsLink")}
          </Link>
        )}
        {session.league && (
          <Link
            href={`/leagues/${session.league.slug}/arquetipos`}
            className="w-fit text-sm text-primary hover:underline"
          >
            {t("leagueArchetypesLink")}
          </Link>
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
          ) : session.status === "setup" ? (
            <form action={joinSessionAction}>
              <input type="hidden" name="session_id" value={id} />
              <Button type="submit">{t("join")}</Button>
            </form>
          ) : null}
        </div>
      )}

      {/* Your match this round — pinned above the standings */}
      {myMatch && (
        <MyMatchCard
          sessionId={id}
          match={myMatch}
          timer={
            latestRound
              ? {
                  roundId: latestRound.id,
                  state: {
                    durationSeconds: latestRound.timer_duration_seconds,
                    endsAt: latestRound.timer_ends_at,
                    remainingSeconds: latestRound.timer_remaining_seconds,
                  },
                }
              : null
          }
          timerLabels={{
            minutesPlaceholder: t("timerMinutesPlaceholder"),
            start: t("timerStart"),
            pause: t("timerPause"),
            resume: t("timerResume"),
            reset: t("timerReset"),
            paused: t("timerPaused"),
            timeUp: t("timerTimeUp"),
          }}
          timerNotify={{
            title: `${t("roundWord")} ${myMatch.roundNumber}`,
            body: t("timerNotifyBody"),
            enable: t("timerAlertsEnable"),
            disable: t("timerAlertsDisable"),
            blocked: t("timerAlertsBlocked"),
          }}
          labels={{
            title: t("myMatchTitle"),
            roundWord: t("roundWord"),
            tableLabel: t("tableLabel"),
            vs: t("vs"),
            win: t("myMatchWin"),
            draw: t("draw"),
            lose: t("myMatchLose"),
            bye: t("bye"),
            loss: t("loss"),
            youWon: t("myMatchYouWon"),
            youLost: t("myMatchYouLost"),
            youDrew: t("myMatchYouDrew"),
          }}
        />
      )}

      {/* My archetypes — stays pinned: it's a one-time action per player and
          burying it behind a tab makes it easy to forget before pairings. */}
      {myPart && (
        <Card>
          <CardHeader>
            <CardTitle>{t("myArchetypes")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {myArchLocked ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {myChips.map((c) => (
                    <span key={c.key} className="flex items-center gap-1">
                      {c.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.icon} alt="" className="h-5 w-5" />
                      )}
                      {c.name}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("archLocked")}
                </p>
              </>
            ) : (
              <ArchetypePicker
                contextId={id}
                contextIdField="session_id"
                customs={activeCustoms}
                initial={{
                  a1: myPart.archetype1 ?? "",
                  a2: myPart.archetype2 ?? "",
                  isPublic: myPart.archetype_public,
                }}
                action={setMyArchetypesAction}
                onVisibilityChange={setArchetypeVisibilityAction.bind(null, id)}
                labels={{
                  title: t("myArchetypes"),
                  hint: t("archHint"),
                  slot1: t("arch1"),
                  slot2: t("arch2"),
                  placeholder: t("archPlaceholder"),
                  search: t("archSearch"),
                  clear: t("archClear"),
                  noResults: t("archNoResults"),
                  publicLabel: t("archPublic"),
                  save: t("archSave"),
                  saved: t("archSaved"),
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {tabs.length > 0 && <SessionTabs tabs={tabs} initial={initialTab} />}
    </main>
  );
}
