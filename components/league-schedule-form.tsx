"use client";

import { useActionState, useState } from "react";
import { updateLeagueScheduleAction, type ActionState } from "@/app/actions/leagues";
import { WEEKDAYS } from "@/lib/weekday";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeagueScheduleForm({
  leagueId,
  slug,
  defaults,
  labels,
}: {
  leagueId: string;
  slug: string;
  defaults: {
    weekday: number | null;
    time: string | null;
    cost: number;
  };
  labels: {
    weekday: string;
    weekdayPlaceholder: string;
    time: string;
    cost: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateLeagueScheduleAction,
    {},
  );
  const [weekday, setWeekday] = useState(
    defaults.weekday != null ? String(defaults.weekday) : "",
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="session_weekday" value={weekday} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.weekday}</label>
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger>
              <SelectValue placeholder={labels.weekdayPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((w) => (
                <SelectItem key={w.value} value={String(w.value)}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ls_time" className="text-sm font-medium">
            {labels.time}
          </label>
          <Input
            id="ls_time"
            name="session_time"
            type="time"
            defaultValue={defaults.time?.slice(0, 5) ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ls_cost" className="text-sm font-medium">
            {labels.cost}
          </label>
          <Input
            id="ls_cost"
            name="default_cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.cost}
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
