"use client";

import { useActionState } from "react";
import {
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  type ActionState,
} from "@/app/actions/stores";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type StoreRow = {
  id: string;
  name: string;
  playLeagueId: string | null;
  leagues: number;
  events: number;
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
};

// One inline edit form per store; the counts say what the delete will
// detach (rows stay, they only lose their store).
function StoreEditor({ store, labels }: { store: StoreRow; labels: Labels }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateStoreAction,
    {},
  );
  return (
    <li className="flex flex-col gap-2 py-3">
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
        {state?.error && <span className="text-destructive">{state.error}</span>}
        {state?.ok && <span className="text-primary">{labels.saved}</span>}
        <form action={deleteStoreAction} className="ml-auto">
          <input type="hidden" name="store_id" value={store.id} />
          <ConfirmDeleteButton confirmMessage={labels.deleteConfirm} variant="ghost" size="sm">
            {labels.delete}
          </ConfirmDeleteButton>
        </form>
      </div>
    </li>
  );
}

export function StoreList({ stores, labels }: { stores: StoreRow[]; labels: Labels }) {
  return (
    <ul className="flex flex-col divide-y">
      {stores.map((s) => (
        <StoreEditor key={s.id} store={s} labels={labels} />
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
