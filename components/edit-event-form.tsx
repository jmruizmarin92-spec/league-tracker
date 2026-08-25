"use client";

import { useActionState, useState } from "react";
import { updateEventAction, type ActionState } from "@/app/actions/events";
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
import {
  NONE,
  type LeagueOption,
  type StoreOption,
} from "@/components/create-event-form";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditEventForm({
  eventId,
  slug,
  stores,
  leagues,
  defaults,
  labels,
}: {
  eventId: string;
  slug: string;
  stores: StoreOption[];
  leagues: LeagueOption[];
  defaults: {
    storeId: string | null;
    leagueId: string | null;
    tournamentId: string | null;
    name: string;
    subtitle: string | null;
    category: string | null;
    startsAt: string | null;
    location: string | null;
    cost: number;
    capacity: number | null;
    externalUrl: string | null;
    description: string | null;
    prizes: string | null;
    listRequired: boolean;
    listLockMinutes: number;
  };
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEventAction,
    {},
  );
  const [local, setLocal] = useState(toDatetimeLocalValue(defaults.startsAt));
  const [listRequired, setListRequired] = useState(defaults.listRequired);
  const [category, setCategory] = useState(defaults.category ?? "");
  const [storeId, setStoreId] = useState(defaults.storeId ?? "");
  const [leagueId, setLeagueId] = useState(defaults.leagueId ?? "");
  const iso = local ? new Date(local).toISOString() : "";
  // The league picker follows the store (all leagues when none is chosen);
  // archived ones are hidden unless this event already points at one.
  const leagueOptions = leagues.filter(
    (l) =>
      (l.id === leagueId || !l.archived) && (storeId === "" || l.storeId === storeId),
  );

  function onStoreChange(v: string) {
    const next = v === NONE ? "" : v;
    setStoreId(next);
    const current = leagues.find((l) => l.id === leagueId);
    if (next && current && current.storeId !== next) setLeagueId("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="starts_at_iso" value={iso} />
      <input type="hidden" name="list_required" value={String(listRequired)} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="league_id" value={leagueId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ee_name" className="text-sm font-medium">
            {labels.name}
          </label>
          <Input id="ee_name" name="name" maxLength={100} defaultValue={defaults.name} />
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.league}</label>
          <Select
            value={leagueId === "" ? NONE : leagueId}
            onValueChange={(v) => setLeagueId(v === NONE ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
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
          <label htmlFor="ee_tid" className="text-sm font-medium">
            {labels.tournamentId}
          </label>
          <Input
            id="ee_tid"
            name="tournament_id"
            maxLength={40}
            defaultValue={defaults.tournamentId ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ee_starts" className="text-sm font-medium">
            {labels.startsAt}
          </label>
          <Input
            id="ee_starts"
            type="datetime-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ee_loc" className="text-sm font-medium">
            {labels.location}
          </label>
          <Input
            id="ee_loc"
            name="location"
            maxLength={120}
            defaultValue={defaults.location ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ee_cost" className="text-sm font-medium">
            {labels.cost}
          </label>
          <Input
            id="ee_cost"
            name="cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.cost}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ee_cap" className="text-sm font-medium">
            {labels.capacity}
          </label>
          <Input
            id="ee_cap"
            name="capacity"
            type="number"
            min={1}
            step={1}
            placeholder={labels.capacityHint}
            defaultValue={defaults.capacity ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ee_lock" className="text-sm font-medium">
            {labels.listLock}
          </label>
          <Input
            id="ee_lock"
            name="list_lock_minutes"
            type="number"
            min={0}
            max={10080}
            step={1}
            defaultValue={defaults.listLockMinutes}
          />
          <p className="text-xs text-muted-foreground">{labels.listLockHint}</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="ee_url" className="text-sm font-medium">
            {labels.externalUrl}
          </label>
          <Input
            id="ee_url"
            name="external_url"
            type="url"
            maxLength={500}
            placeholder={labels.externalUrlHint}
            defaultValue={defaults.externalUrl ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="ee_desc" className="text-sm font-medium">
            {labels.description}
          </label>
          <Textarea
            id="ee_desc"
            name="description"
            rows={2}
            maxLength={1000}
            defaultValue={defaults.description ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="ee_prizes" className="text-sm font-medium">
            {labels.prizes}
          </label>
          <Textarea
            id="ee_prizes"
            name="prizes"
            rows={2}
            maxLength={1000}
            placeholder={labels.prizesHint}
            defaultValue={defaults.prizes ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="ee_subtitle" className="text-sm font-medium">
            {labels.subtitle}
          </label>
          <Input
            id="ee_subtitle"
            name="subtitle"
            maxLength={80}
            placeholder={labels.subtitleHint}
            defaultValue={defaults.subtitle ?? ""}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="ee_listreq"
          checked={listRequired}
          onCheckedChange={setListRequired}
        />
        <label htmlFor="ee_listreq" className="text-sm">
          {labels.listRequired}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
      </div>
    </form>
  );
}
