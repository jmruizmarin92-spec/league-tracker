"use client";

import { useActionState } from "react";
import {
  updateLeaguePointsAction,
  type ActionState,
} from "@/app/actions/leagues";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LeaguePointsForm({
  leagueId,
  slug,
  defaults,
  labels,
}: {
  leagueId: string;
  slug: string;
  defaults: { win: number; attendance: number; draw: number };
  labels: {
    win: string;
    attendance: string;
    draw: string;
    save: string;
    saved: string;
    hint: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateLeaguePointsAction,
    {},
  );

  const numberField = (name: string, label: string, value: number) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        step={1}
        defaultValue={value}
      />
    </div>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {numberField("win_value", labels.win, defaults.win)}
        {numberField("attendance_value", labels.attendance, defaults.attendance)}
        {numberField("draw_value", labels.draw, defaults.draw)}
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
