"use client";

import { useActionState } from "react";
import {
  updateLeagueDurationAction,
  type ActionState,
} from "@/app/actions/leagues";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// A DB date ("2026-01-01") -> the value an <input type="month"> expects.
function toMonthInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 7) : "";
}

export function LeagueDurationForm({
  leagueId,
  slug,
  defaults,
  labels,
}: {
  leagueId: string;
  slug: string;
  defaults: { startsMonth: string | null; endsMonth: string | null };
  labels: {
    startMonth: string;
    endMonth: string;
    hint: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateLeagueDurationAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="starts_month" className="text-sm font-medium">
            {labels.startMonth}
          </label>
          <Input
            id="starts_month"
            name="starts_month"
            type="month"
            defaultValue={toMonthInputValue(defaults.startsMonth)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ends_month" className="text-sm font-medium">
            {labels.endMonth}
          </label>
          <Input
            id="ends_month"
            name="ends_month"
            type="month"
            defaultValue={toMonthInputValue(defaults.endsMonth)}
          />
        </div>
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
