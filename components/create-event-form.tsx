"use client";

import { useActionState, useState } from "react";
import { createEventAction, type ActionState } from "@/app/actions/events";
import {
  composeEventName,
  parsePlayEventPaste,
  PlayPasteError,
  type PlayEventStatus,
} from "@/lib/play-event-paste";
import { matchSeasonLeague, type SeasonCandidate } from "@/lib/season-match";
import { resolvePasteStore } from "@/lib/paste-store";
import { CategorySelect } from "@/components/category-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// What the store/league pickers on the create/edit event forms need. A
// league carries what the season match (lib/season-match) filters on.
export type StoreOption = { id: string; name: string; playLeagueId: string | null };
export type LeagueOption = SeasonCandidate & { name: string };

// Radix Select refuses an item with an empty value, so "none" is a sentinel
// that the hidden inputs turn back into "".
export const NONE = "__none__";

type Fields = {
  name: string;
  subtitle: string;
  location: string;
  cost: string;
  capacity: string;
  tournamentId: string;
  externalUrl: string;
  description: string;
  prizes: string;
  listLockMinutes: string;
};

const EMPTY: Fields = {
  name: "",
  subtitle: "",
  location: "",
  cost: "0",
  capacity: "",
  tournamentId: "",
  externalUrl: "",
  description: "",
  prizes: "",
  listLockMinutes: "60",
};

type Note = { kind: "ok" | "warn" | "error"; text: string };

// fixedStoreId: the form lives on a store's own console (PL-17) — the store
// is not a choice and a pasted page can only confirm it or be flagged as
// another store's.
export function CreateEventForm({
  stores,
  leagues,
  labels,
  fixedStoreId,
}: {
  stores: StoreOption[];
  leagues: LeagueOption[];
  labels: Record<string, string>;
  fixedStoreId?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEventAction,
    {},
  );
  const [game, setGame] = useState("");
  const [category, setCategory] = useState("");
  const [local, setLocal] = useState("");
  const [listRequired, setListRequired] = useState(false);
  const [allowGuests, setAllowGuests] = useState(false);
  const [storeId, setStoreId] = useState(fixedStoreId ?? "");
  const [leagueId, setLeagueId] = useState("");
  const [status, setStatus] = useState<PlayEventStatus>("open");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [paste, setPaste] = useState("");
  const [pasteNotes, setPasteNotes] = useState<Note[]>([]);
  const iso = local ? new Date(local).toISOString() : "";

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  // The league picker follows the store: only that store's seasons (any
  // store's when none is chosen). Archived ones stay hidden unless selected —
  // a completed event from last season is exactly that case.
  const leagueOptions = leagues.filter(
    (l) =>
      (l.id === leagueId || !l.archived) && (storeId === "" || l.storeId === storeId),
  );
  const nameOf = (id: string) => leagues.find((l) => l.id === id)?.name ?? id;

  function onStoreChange(v: string) {
    const next = v === NONE ? "" : v;
    setStoreId(next);
    // A league of another store no longer makes sense once the store moves.
    const current = leagues.find((l) => l.id === leagueId);
    if (next && current && current.storeId !== next) setLeagueId("");
  }

  function applyPaste() {
    let parsed;
    try {
      parsed = parsePlayEventPaste(paste);
    } catch (e) {
      setPasteNotes([
        {
          kind: "error",
          text: e instanceof PlayPasteError ? e.message : labels.pasteError,
        },
      ]);
      return;
    }
    const p = parsed;
    const notes: Note[] = [{ kind: "ok", text: labels.pasteFilled }];

    if (p.game) setGame(p.game);
    setCategory(p.category);
    if (p.startsAtLocal) setLocal(p.startsAtLocal);
    setStatus(p.status);

    // Two-step link: the League ID names the store; the season league is
    // whichever of the store's leagues fits game + format + date. Resolved
    // before the fields are filled because the name carries the store (PL-20).
    const resolved = resolvePasteStore(stores, p.playLeagueId, fixedStoreId);
    const resolvedStore =
      "storeId" in resolved ? stores.find((s) => s.id === resolved.storeId) : undefined;
    // "League Cup Dune Cómics Q1 TCG" — the page title is never the name: cups
    // have none (the header is the date) and the series line says nothing
    // about where. The series line itself becomes the subtitle.
    const name =
      composeEventName({
        title: p.name,
        series: p.series,
        eventType: p.eventType,
        game: p.game,
        storeName: resolvedStore?.name ?? p.activityGroup,
      }) ?? "";
    const seriesLabel = p.series ?? p.eventType ?? "";
    const subtitle =
      seriesLabel && seriesLabel.toLowerCase() !== name.toLowerCase() ? seriesLabel : "";
    const capacity =
      p.status === "complete" && p.players && p.players.total > 0
        ? String(p.players.total)
        : "";
    setFields((f) => ({
      ...f,
      name: name.slice(0, 100),
      subtitle: subtitle.slice(0, 80),
      location: (p.location ?? "").slice(0, 120),
      capacity,
      tournamentId: p.tournamentId ?? "",
      externalUrl: p.website ?? "",
    }));

    if (resolved.kind === "no-id") {
      notes.push({ kind: "warn", text: labels.pasteNoLeagueId });
      setPasteNotes(notes);
      return;
    }
    if (resolved.kind === "unknown") {
      setStoreId("");
      setLeagueId("");
      notes.push({
        kind: "warn",
        text: labels.pasteStoreMissing.replace("{id}", resolved.playLeagueId),
      });
      setPasteNotes(notes);
      return;
    }
    if (resolved.kind === "mismatch") {
      setLeagueId("");
      notes.push({
        kind: "warn",
        text: labels.pasteStoreMismatch.replace("{id}", resolved.playLeagueId),
      });
      setPasteNotes(notes);
      return;
    }
    const store = resolvedStore;
    setStoreId(resolved.storeId);
    if (resolved.kind === "matched" && store) {
      notes.push({ kind: "ok", text: labels.pasteStoreMatched.replace("{name}", store.name) });
    }
    const season = matchSeasonLeague(leagues, {
      storeId: resolved.storeId,
      game: p.game,
      format: p.format,
      startsAtLocal: p.startsAtLocal,
    });
    if (season.kind === "one") {
      setLeagueId(season.id);
      notes.push({
        kind: "ok",
        text: labels.pasteLeagueMatched.replace("{name}", nameOf(season.id)),
      });
    } else {
      setLeagueId("");
      notes.push({
        kind: "warn",
        text: season.kind === "none" ? labels.pasteLeagueNone : labels.pasteLeagueMany,
      });
    }
    setPasteNotes(notes);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="game" value={game} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="starts_at_iso" value={iso} />
      <input type="hidden" name="list_required" value={String(listRequired)} />
      <input type="hidden" name="allow_guest_lists" value={String(allowGuests)} />
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="status" value={status} />

      <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
        <label htmlFor="e_paste" className="text-sm font-medium">
          {labels.pasteTitle}
        </label>
        <p className="text-xs text-muted-foreground">{labels.pasteHint}</p>
        <Textarea
          id="e_paste"
          rows={4}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={labels.pastePlaceholder}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={paste.trim() === ""}
            onClick={applyPaste}
          >
            {labels.pasteCta}
          </Button>
        </div>
        {pasteNotes.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs">
            {pasteNotes.map((n, i) => (
              <li
                key={i}
                className={
                  n.kind === "error"
                    ? "text-destructive"
                    : n.kind === "warn"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                }
              >
                {n.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">{labels.name}</label>
          <Input
            id="name"
            name="name"
            maxLength={100}
            value={fields.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.category}</label>
          <CategorySelect
            value={category}
            onChange={setCategory}
            placeholder={labels.categoryPlaceholder}
            noneLabel={labels.categoryNone}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.game}</label>
          <Select value={game} onValueChange={setGame}>
            <SelectTrigger>
              <SelectValue placeholder={labels.gamePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tcg">TCG</SelectItem>
              <SelectItem value="vgc">VGC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_starts" className="text-sm font-medium">{labels.startsAt}</label>
          <Input id="e_starts" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} />
        </div>
        {!fixedStoreId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{labels.store}</label>
            <Select value={storeId === "" ? NONE : storeId} onValueChange={onStoreChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{labels.storeNone}</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.league}</label>
          <Select
            value={leagueId === "" ? NONE : leagueId}
            onValueChange={(v) => setLeagueId(v === NONE ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={labels.leaguePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{labels.leagueNone}</SelectItem>
              {leagueOptions.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.status}</label>
          <Select value={status} onValueChange={(v) => setStatus(v as PlayEventStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{labels.statusOpen}</SelectItem>
              <SelectItem value="closed">{labels.statusClosed}</SelectItem>
              <SelectItem value="complete">{labels.statusComplete}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_tid" className="text-sm font-medium">{labels.tournamentId}</label>
          <Input
            id="e_tid"
            name="tournament_id"
            maxLength={40}
            placeholder={labels.tournamentIdHint}
            value={fields.tournamentId}
            onChange={(e) => setField("tournamentId", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_loc" className="text-sm font-medium">{labels.location}</label>
          <Input
            id="e_loc"
            name="location"
            maxLength={120}
            value={fields.location}
            onChange={(e) => setField("location", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_cost" className="text-sm font-medium">{labels.cost}</label>
          <Input
            id="e_cost"
            name="cost"
            type="number"
            min={0}
            step="0.01"
            value={fields.cost}
            onChange={(e) => setField("cost", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_cap" className="text-sm font-medium">{labels.capacity}</label>
          <Input
            id="e_cap"
            name="capacity"
            type="number"
            min={1}
            step={1}
            placeholder={labels.capacityHint}
            value={fields.capacity}
            onChange={(e) => setField("capacity", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e_lock" className="text-sm font-medium">{labels.listLock}</label>
          <Input
            id="e_lock"
            name="list_lock_minutes"
            type="number"
            min={0}
            max={10080}
            step={1}
            value={fields.listLockMinutes}
            onChange={(e) => setField("listLockMinutes", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{labels.listLockHint}</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_url" className="text-sm font-medium">{labels.externalUrl}</label>
          <Input
            id="e_url"
            name="external_url"
            type="url"
            maxLength={500}
            placeholder={labels.externalUrlHint}
            value={fields.externalUrl}
            onChange={(e) => setField("externalUrl", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_desc" className="text-sm font-medium">{labels.description}</label>
          <Textarea
            id="e_desc"
            name="description"
            rows={2}
            maxLength={1000}
            value={fields.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_prizes" className="text-sm font-medium">{labels.prizes}</label>
          <Textarea
            id="e_prizes"
            name="prizes"
            rows={2}
            maxLength={1000}
            placeholder={labels.prizesHint}
            value={fields.prizes}
            onChange={(e) => setField("prizes", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e_subtitle" className="text-sm font-medium">
            {labels.subtitle}
          </label>
          <Input
            id="e_subtitle"
            name="subtitle"
            maxLength={80}
            placeholder={labels.subtitleHint}
            value={fields.subtitle}
            onChange={(e) => setField("subtitle", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="e_listreq" checked={listRequired} onCheckedChange={setListRequired} />
        <label htmlFor="e_listreq" className="text-sm">{labels.listRequired}</label>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Switch id="e_guests" checked={allowGuests} onCheckedChange={setAllowGuests} />
          <label htmlFor="e_guests" className="text-sm">{labels.allowGuests}</label>
        </div>
        <p className="text-xs text-muted-foreground">{labels.allowGuestsHint}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !game}>{labels.cta}</Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}
