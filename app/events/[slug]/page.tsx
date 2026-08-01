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
import { listPlayers } from "@/lib/players";
import { getUser, getProfile } from "@/lib/auth";
import { pairingName } from "@/lib/player-name";
import { formatDateTime, formatCost } from "@/lib/format";
import { resolveArchetypes, listCustoms, type ArchetypeChip } from "@/lib/archetypes";
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
import { Breadcrumbs } from "@/components/breadcrumbs";
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
  const tb = await getTranslations("breadcrumbs");
  const [admin, regs, myReg, user, viewerProfile, staff, customsAll] = await Promise.all([
    isEventAdmin(event.id),
    listRegistrations(event.id),
    getMyRegistration(event.id),
    getUser(),
    getProfile(),
    listEventStaff(event.id),
    listCustoms(event.game),
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
        <Link
          href={`/events/${slug}/arquetipos`}
          className="w-fit text-sm text-primary hover:underline"
        >
          {t("archetypesLink")}
        </Link>
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
                  a1: myReg.archetype1 ?? "",
                  a2: myReg.archetype2 ?? "",
                  isPublic: myReg.archetype_public,
                }}
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

      {/* Participants — admin-only: the roster carries player IDs and links to
          every submitted list, so it isn't something the field should browse. */}
      {admin && (
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
      )}

      {/* Staff (judges, scorekeepers, helpers) */}
      {(staff.length > 0 || admin) && (
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
      )}

      {/* Edit event details */}
      {admin && (
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
      )}

      {/* Admin status */}
      {admin && (
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
      )}

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
    </main>
  );
}
