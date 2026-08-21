import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getEventBySlug,
  isEventAdmin,
  listRegistrations,
  getMyRegistration,
  getEventLists,
  listEventStaff,
  type EventParticipant,
} from "@/lib/events";
import { eventEntryDeadline, isEventEntryLocked } from "@/lib/event-deadline";
import {
  getEventRounds,
  getEventMatches,
  getEventStandings,
  getLastTdfImport,
  type EventMatchRow,
  type EventRoundRow,
} from "@/lib/event-rounds";
import { listPlayers, getMyPlayer, getPlayersByIds } from "@/lib/players";
import { computeStandings, type MatchInput } from "@/lib/scoring";
import { divisionLabel } from "@/lib/tdf";
import { getUser, getProfile } from "@/lib/auth";
import { pairingName } from "@/lib/player-name";
import { formatDateTime, formatCost } from "@/lib/format";
import { resolveArchetypes, listCustoms, type ArchetypeChip } from "@/lib/archetypes";
import { listMyDecks, latestDeck } from "@/lib/decks";
import {
  adminRemoveRegistrationAction,
  setEventStatusAction,
  deleteEventAction,
  removeEventStaffAction,
  createEventStaffPlayerAction,
  setMyEventArchetypesAction,
  adminSetEventParticipantArchetypesAction,
  setEventArchetypeVisibilityAction,
  adminSetEventCheckedInAction,
} from "@/app/actions/events";
import { clearEventTdfAction } from "@/app/actions/event-tdf";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import {
  EventPairings,
  type EventDivisionView,
  type EventMatchView,
} from "@/components/event-pairings";
import { EventMyMatch, type EventMyMatchView } from "@/components/event-my-match";
import { EventRealtimeRefresher } from "@/components/event-realtime-refresher";
import { TdfImport } from "@/components/tdf-import";
import { StandingsTable } from "@/components/standings-table";
import { EventRegister } from "@/components/event-register";
import { ParticipantListEditor } from "@/components/participant-list-editor";
import { EditEventForm } from "@/components/edit-event-form";
import { AddStaffForm } from "@/components/add-staff-form";
import { ArchetypePicker } from "@/components/archetype-picker";
import {
  ParticipantsList,
  type ParticipantRowData,
} from "@/components/participants-list";
import { CopyPokemonIds } from "@/components/copy-pokemon-ids";
import { CategoryBadge } from "@/components/category-badge";
import { GameBadge } from "@/components/game-badge";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const tt = await getTranslations("eventTom");
  const tb = await getTranslations("breadcrumbs");
  const [
    admin,
    regs,
    myReg,
    user,
    viewerProfile,
    staff,
    customsAll,
    tomRounds,
    tomMatches,
    tomPlaces,
    myPlayer,
    myDecks,
  ] = await Promise.all([
    isEventAdmin(event.id),
    listRegistrations(event.id),
    getMyRegistration(event.id),
    getUser(),
    getProfile(),
    listEventStaff(event.id),
    listCustoms(event.game),
    getEventRounds(event.id),
    getEventMatches(event.id),
    getEventStandings(event.id),
    getMyPlayer(),
    listMyDecks(event.game),
  ]);
  const isSiteAdmin = !!viewerProfile?.is_admin;
  const lists = admin ? await getEventLists(event.id) : new Map();

  const staffIds = new Set(staff.map((s) => s.player_id));
  const addableStaff = admin
    ? (await listPlayers())
        .filter((p) => !staffIds.has(p.id))
        .map((p) => ({ id: p.id, label: pairingName(p) }))
    : [];

  const registered = regs.filter((r) => r.status === "registered");
  const waitlisted = regs.filter((r) => r.status === "waitlisted");
  const isTcg = event.game === "tcg";

  const activeCustoms = customsAll
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, icon_url: c.icon_url }));
  const chips = await resolveArchetypes(
    regs.flatMap((r) => [r.archetype1, r.archetype2]),
  );
  const isComplete = event.status === "complete";
  // Once the event is complete, a player can no longer edit an archetype they
  // already recorded — only add one if they never set anything (mirrors
  // set_event_archetypes' own lock, 0036_event_archetypes.sql). Admin edits
  // stay unrestricted (the roster's own picker below).
  const myArchLocked =
    isComplete && !!myReg && (!!myReg.archetype1 || !!myReg.archetype2);
  const myChips = myReg
    ? [myReg.archetype1, myReg.archetype2]
        .filter((k): k is string => !!k)
        .map((k) => chips.get(k))
        .filter((c): c is ArchetypeChip => !!c)
    : [];
  // Saved decks (PL-3): chips for the self picker, plus a prefill from the
  // most recently used deck when this registration has no picks yet (Save
  // still required — the row stays null until then).
  const myHasPicks = !!myReg && (!!myReg.archetype1 || !!myReg.archetype2);
  const prefillDeck = !myHasPicks ? latestDeck(myDecks, event.game) : null;

  // Registration + list submission close a set number of minutes before the
  // start (default 60). Admins are never locked out so they can still fix a
  // list or sign someone up on the day.
  const entryDeadline = eventEntryDeadline(event);
  const entryLocked = isEventEntryLocked(event) && !admin;
  const deadlineWhen = entryDeadline ? formatDateTime(entryDeadline.toISOString()) : null;

  // Pokémon IDs of every registrant (registered + waitlist) for tournament
  // upload; players without an ID are omitted from the copy list but surfaced
  // separately so admins can chase them down. Mirrors the session roster.
  const pokemonIds = regs
    .map((r) => r.pokemon_id?.trim())
    .filter((v): v is string => !!v);
  const missingPokemonIds = regs
    .filter((r) => !r.pokemon_id?.trim())
    .map((r) => ({ id: r.player_id, name: pairingName(r) }));

  // -------------------------------------------------------------------------
  // TOM (.tdf) pairings. Everything here mirrors the judge's laptop — the site
  // never pairs a standalone event itself, it only shows what was imported.
  // -------------------------------------------------------------------------
  const tomPlayerIds = [
    ...new Set(
      tomMatches.flatMap((m) =>
        [m.player1_id, m.player2_id].filter((id): id is string => !!id),
      ),
    ),
  ];
  const tomNames = await getPlayersByIds(tomPlayerIds);
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = tomNames.get(id);
    return p ? pairingName(p) : "—";
  };
  const matchesByRound = new Map<string, EventMatchRow[]>();
  for (const m of tomMatches) {
    const list = matchesByRound.get(m.round_id) ?? [];
    list.push(m);
    matchesByRound.set(m.round_id, list);
  }

  // Top-cut rounds keep counting up from the swiss ("R5", "R6"), which tells a
  // player nothing. Name them by how many tables are left instead.
  const roundLabel = (r: EventRoundRow) => {
    if (!r.is_finals) return `${tt("roundLabel")} ${r.number}`;
    const n = (matchesByRound.get(r.id) ?? []).length;
    if (n <= 1) return tt("finalLabel");
    if (n === 2) return tt("semifinalLabel");
    if (n === 4) return tt("quarterfinalLabel");
    return tt("topLabel", { n: n * 2 });
  };

  const myId = myPlayer?.id ?? null;
  const isMine = (m: EventMatchRow) =>
    !!myId && (m.player1_id === myId || m.player2_id === myId);

  const toMatchView = (m: EventMatchRow): EventMatchView => ({
    id: m.id,
    table: m.table_number,
    p1Name: nameOf(m.player1_id) ?? "—",
    p2Name: nameOf(m.player2_id),
    official: m.official_result,
    reported: m.reported_result,
    isMine: isMine(m),
    // Your own undecided pairing, or any of them if you're running the event —
    // the judge takes a call at the table as often as the players tap it in.
    // Once TOM has ruled there is nothing left to signal.
    canReport:
      (isMine(m) || admin) && !!m.player2_id && m.official_result === "pending",
  });

  // Age divisions run as parallel tournaments in the same file.
  const divisions: EventDivisionView[] = [];
  for (const r of tomRounds) {
    const key = String(r.division);
    let division = divisions.find((d) => d.key === key);
    if (!division) {
      division = { key, label: divisionLabel(r.division), rounds: [] };
      divisions.push(division);
    }
    division.rounds.push({
      id: r.id,
      label: roundLabel(r),
      matches: (matchesByRound.get(r.id) ?? []).map(toMatchView),
    });
  }

  // The last round the viewer appears in — rounds arrive already ordered by
  // division and number, so the final hit is the current one.
  let myMatch: EventMyMatchView | null = null;
  if (myId) {
    for (const r of tomRounds) {
      const found = (matchesByRound.get(r.id) ?? []).find(isMine);
      if (!found) continue;
      const iAmP1 = found.player1_id === myId;
      myMatch = {
        id: found.id,
        roundLabel: roundLabel(r),
        table: found.table_number,
        opponentName: nameOf(iAmP1 ? found.player2_id : found.player1_id),
        iAmP1,
        official: found.official_result,
        reported: found.reported_result,
      };
    }
  }

  // Once the TO exports a closed tournament the file carries TOM's own final
  // placings. Those are the real answer, so they replace the computed table
  // rather than sitting next to it.
  const officialPlaces: { division: number; label: string; rows: { place: number; name: string }[] }[] = [];
  for (const s of tomPlaces) {
    let group = officialPlaces.find((g) => g.division === s.division);
    if (!group) {
      group = { division: s.division, label: divisionLabel(s.division), rows: [] };
      officialPlaces.push(group);
    }
    group.rows.push({ place: s.place, name: nameOf(s.player_id) ?? "—" });
  }
  const hasOfficialPlaces = officialPlaces.length > 0;

  // Provisional standings off the official results only. TOM computes the real
  // ones with the full tiebreaker chain; this is the same scorer the leagues
  // use, which is close but not the tournament's own answer — hence the note
  // under the table. Dropped entirely once the real placings arrive.
  const tomStandings = divisions.map((d) => {
    const rows = tomRounds
      .filter((r) => String(r.division) === d.key)
      .flatMap((r) => matchesByRound.get(r.id) ?? []);
    const ids = [
      ...new Set(
        rows.flatMap((m) =>
          [m.player1_id, m.player2_id].filter((x): x is string => !!x),
        ),
      ),
    ];
    const inputs: MatchInput[] = rows.flatMap((m): MatchInput[] => {
      // A TOM double loss has no session equivalent: book it as a played,
      // pointless round for each side. That drops the pair from each other's
      // OWP, which is part of why this table is labelled provisional.
      if (m.official_result === "double_loss") {
        return [
          { player1: m.player1_id, player2: null, result: "loss" as const },
          ...(m.player2_id
            ? [{ player1: m.player2_id, player2: null, result: "loss" as const }]
            : []),
        ];
      }
      return [
        {
          player1: m.player1_id,
          player2: m.player2_id,
          result: m.official_result,
        },
      ];
    });
    return { ...d, standings: computeStandings(ids, inputs) };
  });
  const hasStandings =
    !hasOfficialPlaces &&
    tomStandings.some((d) => d.standings.some((r) => r.played > 0));
  const standingsNames = new Map(
    [...tomNames].map(([id, p]) => [id, pairingName(p)]),
  );

  const lastImport = admin ? await getLastTdfImport(event.id) : null;

  const rosterProps = {
    contextId: event.id,
    contextIdField: "event_id",
    customs: activeCustoms,
    action: setMyEventArchetypesAction,
    adminAction: adminSetEventParticipantArchetypesAction,
    extraFields: { slug },
    setCheckedInAction: adminSetEventCheckedInAction.bind(null, slug),
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
      noPokemonId: t("noPokemonId"),
    },
  };

  const toRow = (r: EventParticipant): ParticipantRowData => {
    const list = lists.get(r.player_id);
    return {
      playerId: r.player_id,
      pokemonId: r.pokemon_id,
      checkedIn: r.checked_in,
      name: (
        <span className="flex items-center gap-2">
          {pairingName(r)}
          {r.has_list && <Badge variant="outline">{t("listSubmitted")}</Badge>}
        </span>
      ),
      chips: [r.archetype1, r.archetype2]
        .filter((k): k is string => !!k)
        .map((k) => chips.get(k))
        .filter((c): c is ArchetypeChip => !!c),
      initial: {
        a1: r.archetype1 ?? "",
        a2: r.archetype2 ?? "",
        isPublic: r.archetype_public,
      },
      actions: (
        <form action={adminRemoveRegistrationAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="player_id" value={r.player_id} />
          <Button type="submit" variant="ghost" size="sm">
            {t("remove")}
          </Button>
        </form>
      ),
      extra: (
        <ParticipantListEditor
          slug={slug}
          eventId={event.id}
          playerId={r.player_id}
          initial={{ content: list?.content ?? null, url: list?.url ?? null }}
          labels={{
            viewList: t("viewList"),
            openList: t("openList"),
            noList: t("noListSubmitted"),
            edit: t("editList"),
            close: t("archEditClose"),
            listLabel: isTcg ? t("listLabelTcg") : t("listLabelVgc"),
            listPlaceholder: isTcg
              ? t("listPlaceholderTcg")
              : t("listPlaceholderVgc"),
            urlLabel: t("urlLabel"),
            urlPlaceholder: t("urlPlaceholder"),
            save: t("saveList"),
            saved: t("saved"),
          }}
        />
      ),
    };
  };

  const meta = [
    formatDateTime(event.starts_at),
    event.location,
    formatCost(event.cost),
    event.capacity ? `${t("capacity")}: ${event.capacity}` : null,
  ].filter(Boolean);

  // Staff is public information (who's judging), but the add/create forms are
  // not. Same panel either way: admins get it inside the manage tab with the
  // forms, everyone else gets the read-only list pinned above the tabs.
  const staffPanel = (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("staffTitle")} ({staff.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStaff")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {staff.map((s) => (
              <li
                key={s.player_id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="flex items-center gap-2">
                  {s.display_name}
                  <Badge variant="outline">{s.role}</Badge>
                </span>
                {admin && (
                  <form action={removeEventStaffAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="player_id" value={s.player_id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t("remove")}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {admin && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("addStaff")}</span>
              <AddStaffForm
                eventId={event.id}
                slug={slug}
                players={addableStaff}
                labels={{
                  placeholder: t("choosePlayer"),
                  rolePlaceholder: t("rolePlaceholder"),
                  cta: t("add"),
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("createStaffPlayer")}</span>
              <p className="text-sm text-muted-foreground">
                {t("createStaffPlayerHint")}
              </p>
              <form
                action={createEventStaffPlayerAction}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="slug" value={slug} />
                <Input
                  name="name"
                  maxLength={60}
                  placeholder={t("newPlayerPlaceholder")}
                  className="sm:flex-1"
                />
                <Input
                  name="role"
                  maxLength={60}
                  placeholder={t("rolePlaceholder")}
                  className="sm:w-44"
                />
                <Button type="submit" variant="secondary">
                  {t("createPlayerCta")}
                </Button>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Everything that isn't the header or a player's own business (their match,
  // registration, archetypes) lives in tabs, the same shape as the session
  // page — an event run by an admin was one very long scroll otherwise.
  const tabs: PageTab[] = [];

  if (tomRounds.length > 0) {
    tabs.push({
      value: "pairings",
      label: tt("pairingsTitle"),
      content: (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <EventPairings
              slug={slug}
              divisions={divisions}
              labels={{
                bye: tt("bye"),
                draw: tt("draw"),
                doubleLoss: tt("doubleLoss"),
                vs: tt("vs"),
                tableLabel: tt("tableLabel"),
                mine: tt("mine"),
                win: tt("win"),
                unconfirmed: tt("unconfirmed"),
                noPairings: tt("noPairings"),
              }}
            />
            <p className="text-sm text-muted-foreground">
              {admin ? tt("officialNoteAdmin") : tt("officialNote")}
            </p>
          </CardContent>
        </Card>
      ),
    });
  }

  // Final placings and the provisional table are mutually exclusive (the real
  // ones replace the computed ones), so one tab holds whichever exists. Both
  // keep their card title: "final" vs "provisional" is the whole point.
  if (hasOfficialPlaces || hasStandings) {
    tabs.push({
      value: "standings",
      label: t("tabStandings"),
      content: hasOfficialPlaces ? (
        <Card>
          <CardHeader>
            <CardTitle>{tt("finalStandingsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {officialPlaces.map((d) => (
              <div key={d.division} className="flex flex-col gap-2">
                {officialPlaces.length > 1 && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {d.label}
                  </span>
                )}
                <ol className="flex flex-col divide-y">
                  {d.rows.map((r) => (
                    <li
                      key={r.place}
                      className="flex items-center gap-3 py-1.5 text-sm"
                    >
                      <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                        {r.place}
                      </span>
                      <span
                        className={`min-w-0 truncate ${r.place === 1 ? "font-semibold" : ""}`}
                        title={r.name}
                      >
                        {r.name}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              {tt("finalStandingsNote")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{tt("standingsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {tomStandings.map((d) => (
              <div key={d.key} className="flex flex-col gap-2">
                {tomStandings.length > 1 && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {d.label}
                  </span>
                )}
                <StandingsTable
                  rows={d.standings}
                  names={standingsNames}
                  labels={{
                    rank: tt("rank"),
                    player: tt("player"),
                    points: tt("points"),
                    record: tt("record"),
                    oppWinRate: tt("oppWinRate"),
                  }}
                />
              </div>
            ))}
            <p className="text-sm text-muted-foreground">{tt("standingsNote")}</p>
          </CardContent>
        </Card>
      ),
    });
  }

  // Participants — admin-only: the roster carries player IDs and links to
  // every submitted list, so it isn't something the field should browse.
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
                    n: registered.filter((r) => r.checked_in).length,
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
                <ParticipantsList {...rosterProps} rows={waitlisted.map(toRow)} />
              </div>
            )}

            {regs.length > 0 && (
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
                    {t("pokemonIdsMissing", { count: missingPokemonIds.length })}{" "}
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
        <div className="flex flex-col gap-6">
          {staffPanel}

          {/* TOM import — the TO drops the .tdf here after pairing each round */}
          <Card>
            <CardHeader>
              <CardTitle>{tt("importTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TdfImport
                eventId={event.id}
                slug={slug}
                labels={{
                  hint: tt("importHint"),
                  pick: tt("importPick"),
                  read: tt("importRead"),
                  reading: tt("importReading"),
                  reviewTitle: tt("importReviewTitle"),
                  playersTitle: tt("importPlayersTitle"),
                  playersHint: tt("importPlayersHint"),
                  createNew: tt("importCreateNew"),
                  sourceMapped: tt("importSourceMapped"),
                  sourcePokemonId: tt("importSourcePokemonId"),
                  sourceName: tt("importSourceName"),
                  sourceNone: tt("importSourceNone"),
                  roundsTitle: tt("importRoundsTitle"),
                  roundLabel: tt("importRoundLabel"),
                  matchesLabel: tt("importMatchesLabel"),
                  confirm: tt("importConfirm"),
                  importing: tt("importImporting"),
                  cancel: tt("importCancel"),
                  imported: tt("importDone"),
                }}
              />

              {lastImport && (
                <p className="text-sm text-muted-foreground">
                  {tt("lastImport", {
                    file: lastImport.file_name ?? lastImport.tdf_id ?? "—",
                    when: formatDateTime(lastImport.imported_at) ?? "—",
                  })}
                </p>
              )}

              {tomRounds.length > 0 && (
                <div className="flex flex-col items-start justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{tt("clearTitle")}</span>
                    <span className="text-sm text-muted-foreground">
                      {tt("clearHint")}
                    </span>
                  </div>
                  <form action={clearEventTdfAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <ConfirmDeleteButton confirmMessage={tt("clearConfirm")}>
                      {tt("clearCta")}
                    </ConfirmDeleteButton>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit event details */}
          <Card>
            <CardHeader>
              <CardTitle>{t("editTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <EditEventForm
                eventId={event.id}
                slug={slug}
                defaults={{
                  name: event.name,
                  subtitle: event.subtitle,
                  category: event.category,
                  startsAt: event.starts_at,
                  location: event.location,
                  cost: event.cost,
                  capacity: event.capacity,
                  externalUrl: event.external_url,
                  description: event.description,
                  prizes: event.prizes,
                  listRequired: event.list_required,
                  listLockMinutes: event.list_lock_minutes,
                }}
                labels={{
                  name: t("eName"),
                  subtitle: t("fSubtitle"),
                  subtitleHint: t("subtitleHint"),
                  category: t("fCategory"),
                  categoryPlaceholder: t("categoryPlaceholder"),
                  categoryNone: t("categoryNone"),
                  startsAt: t("eStartsAt"),
                  location: t("eLocation"),
                  cost: t("eCost"),
                  capacity: t("eCapacity"),
                  capacityHint: t("eCapacityHint"),
                  externalUrl: t("eExternalUrl"),
                  externalUrlHint: t("eExternalUrlHint"),
                  description: t("eDescription"),
                  prizes: t("ePrizes"),
                  prizesHint: t("ePrizesHint"),
                  listRequired: t("eListRequired"),
                  listLock: t("eListLock"),
                  listLockHint: t("eListLockHint"),
                  save: t("save"),
                  saved: t("saved"),
                }}
              />
            </CardContent>
          </Card>

          {/* Admin status */}
          <Card>
            <CardHeader>
              <CardTitle>{t("adminTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("statusLabel")}</span>
              <div className="flex flex-wrap gap-2">
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

          {/* Hard delete (site admin only) */}
          {isSiteAdmin && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle>{t("dangerZone")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-muted-foreground">
                  {t("deleteEventHint")}
                </p>
                <form action={deleteEventAction}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <ConfirmDeleteButton confirmMessage={t("confirmDeleteEvent")}>
                    {t("deleteEvent")}
                  </ConfirmDeleteButton>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    });
  }

  // Before anything is imported an admin's job is the roster (check-in, IDs to
  // upload into TOM), not pairings that don't exist yet — land them there.
  const initialTab = admin && tomRounds.length === 0 ? "participants" : "pairings";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Breadcrumbs
          items={[{ label: tb("home"), href: "/" }, { label: event.name }]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {event.name}
          </h1>
          <GameBadge game={event.game} />
          <CategoryBadge category={event.category} />
          {event.subtitle && <Badge variant="outline">{event.subtitle}</Badge>}
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
              <ExternalLink className="size-3.5" />
              {t("externalLink")}
            </a>
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/events/${slug}/arquetipos`}
            className="text-sm text-primary hover:underline"
          >
            {t("archetypesLink")}
          </Link>
          {tomRounds.length > 0 && (
            <Link
              href={`/events/${slug}/display`}
              className="text-sm text-primary hover:underline"
            >
              {tt("displayLink")}
            </Link>
          )}
        </div>
      </div>

      {/* Live pairings keep themselves fresh: the TO re-drops the .tdf after
          every round and nobody in the venue should have to reload. */}
      {tomRounds.length > 0 && event.status !== "complete" && (
        <EventRealtimeRefresher eventId={event.id} />
      )}

      {/* Pinned above everything: which table, against whom. */}
      {myMatch && (
        <EventMyMatch
          slug={slug}
          match={myMatch}
          labels={{
            title: tt("myMatchTitle"),
            tableLabel: tt("tableLabel"),
            vs: tt("vs"),
            win: tt("win"),
            draw: tt("draw"),
            lose: tt("lose"),
            bye: tt("bye"),
            youWon: tt("youWon"),
            youLost: tt("youLost"),
            youDrew: tt("youDrew"),
            doubleLoss: tt("doubleLoss"),
            reportHint: tt("reportHint"),
            reportedYouWon: tt("reportedYouWon"),
            reportedYouLost: tt("reportedYouLost"),
            reportedDraw: tt("reportedDraw"),
          }}
        />
      )}

      {/* Prizes stay pinned: it's the one bit of event info a player reads
          before deciding to come, and it's two lines. */}
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
              locked={entryLocked}
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
                entryLocked: deadlineWhen
                  ? t("entryLockedAt", { when: deadlineWhen })
                  : t("entryLocked"),
                deadlineNote: deadlineWhen
                  ? t("entryDeadlineNote", { when: deadlineWhen })
                  : null,
                noList: t("noListSubmitted"),
                openList: t("openList"),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("signInToRegister")}</p>
      )}

      {/* My archetypes */}
      {myReg && (
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
                <p className="text-sm text-muted-foreground">{t("archLocked")}</p>
              </>
            ) : (
              <ArchetypePicker
                contextId={event.id}
                contextIdField="event_id"
                customs={activeCustoms}
                initial={{
                  a1: myReg.archetype1 ?? prefillDeck?.a1 ?? "",
                  a2: myReg.archetype2 ?? prefillDeck?.a2 ?? "",
                  isPublic: myReg.archetype_public,
                }}
                decks={myDecks}
                prefilled={!!prefillDeck}
                action={setMyEventArchetypesAction}
                extraFields={{ slug }}
                onVisibilityChange={setEventArchetypeVisibilityAction.bind(
                  null,
                  event.id,
                  slug,
                )}
                labels={{
                  title: t("myArchetypes"),
                  hint: t("archHint"),
                  decks: t("archDecks"),
                  prefilled: t("archPrefilled"),
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

      {/* Staff is public; admins manage it from the manage tab instead. */}
      {!admin && staff.length > 0 && staffPanel}

      {tabs.length > 0 && <PageTabs tabs={tabs} initial={initialTab} />}
    </main>
  );
}
