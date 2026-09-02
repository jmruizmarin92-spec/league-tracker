"use client";

import { useActionState } from "react";
import { updateStoreAction, type ActionState } from "@/app/actions/stores";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Name + Play! League ID of one store, for the store console (PL-17). The
// same action backs the inline editor on /admin/stores.
export function StoreDetailsForm({
  storeId,
  slug,
  defaults,
  labels,
}: {
  storeId: string;
  slug: string;
  defaults: { name: string; playLeagueId: string | null };
  labels: {
    name: string;
    playLeagueId: string;
    playLeagueIdHint: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateStoreAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="store_name" className="text-sm font-medium">
            {labels.name}
          </label>
          <Input id="store_name" name="name" maxLength={80} defaultValue={defaults.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="store_play" className="text-sm font-medium">
            {labels.playLeagueId}
          </label>
          <Input
            id="store_play"
            name="play_league_id"
            inputMode="numeric"
            maxLength={20}
            placeholder={labels.playLeagueIdHint}
            defaultValue={defaults.playLeagueId ?? ""}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
      </div>
    </form>
  );
}
