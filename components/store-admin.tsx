"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  type ActionState,
} from "@/app/actions/stores";
import type { StoreAdmin } from "@/lib/stores";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { StoreRoster, type RosterLabels } from "@/components/store-roster";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  playLeagueId: string | null;
  leagues: number;
  events: number;
  admins: StoreAdmin[];
};

type Labels = {
  name: string;
  playLeagueId: string;
  playLeagueIdHint: string;
  save: string;
  saved: string;
  delete: string;
  deleteConfirm: string;
  leaguesCount: string; // "{n} ligas"
  eventsCount: string; // "{n} eventos"
  createCta: string;
  console: string;
  adminsTitle: string;
  roster: RosterLabels;
};

// One inline edit form per store; the counts say what the delete will
// detach (rows stay, they only lose their store). The roster below it is
// where site admins hand a store to its owners (PL-17).
function StoreEditor({
  store,
  users,
  labels,
}: {
  store: StoreRow;
  users: { id: string; display_name: string }[];
  labels: Labels;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateStoreAction,
    {},
  );
  const onRoster = new Set(store.admins.map((a) => a.user_id));
  return (
    <li className="flex flex-col gap-3 py-4">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="store_id" value={store.id} />
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`st_name_${store.id}`} className="text-xs text-muted-foreground">
            {labels.name}
          </label>
          <Input
            id={`st_name_${store.id}`}
            name="name"
            maxLength={80}
            defaultValue={store.name}
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-48">
          <label htmlFor={`st_play_${store.id}`} className="text-xs text-muted-foreground">
            {labels.playLeagueId}
          </label>
          <Input
            id={`st_play_${store.id}`}
            name="play_league_id"
            inputMode="numeric"
            maxLength={20}
            placeholder={labels.playLeagueIdHint}
            defaultValue={store.playLeagueId ?? ""}
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {labels.save}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{labels.leaguesCount.replace("{n}", String(store.leagues))}</span>
        <span>{labels.eventsCount.replace("{n}", String(store.events))}</span>
        <Link href={`/stores/${store.slug}/admin`} className="underline-offset-4 hover:underline">
          {labels.console}
        </Link>
        {state?.error && <span className="text-destructive">{state.error}</span>}
        {state?.ok && <span className="text-primary">{labels.saved}</span>}
        <form action={deleteStoreAction} className="ml-auto">
          <input type="hidden" name="store_id" value={store.id} />
          <ConfirmDeleteButton confirmMessage={labels.deleteConfirm} variant="ghost" size="sm">
            {labels.delete}
          </ConfirmDeleteButton>
        </form>
      </div>
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <span className="text-xs font-medium text-muted-foreground">{labels.adminsTitle}</span>
        <StoreRoster
          storeId={store.id}
          slug={store.slug}
          admins={store.admins}
          users={users.filter((u) => !onRoster.has(u.id))}
          canManage
          canSetOwner
          labels={labels.roster}
        />
      </div>
    </li>
  );
}

export function StoreList({
  stores,
  users,
  labels,
}: {
  stores: StoreRow[];
  users: { id: string; display_name: string }[];
  labels: Labels;
}) {
  return (
    <ul className="flex flex-col divide-y">
      {stores.map((s) => (
        <StoreEditor key={s.id} store={s} users={users} labels={labels} />
      ))}
    </ul>
  );
}

export function CreateStoreForm({ labels }: { labels: Labels }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createStoreAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="st_new_name" className="text-sm font-medium">
            {labels.name}
          </label>
          <Input id="st_new_name" name="name" maxLength={80} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="st_new_play" className="text-sm font-medium">
            {labels.playLeagueId}
          </label>
          <Input
            id="st_new_play"
            name="play_league_id"
            inputMode="numeric"
            maxLength={20}
            placeholder={labels.playLeagueIdHint}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {labels.createCta}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
      </div>
    </form>
  );
}
