"use client";

import { useActionState, useState } from "react";
import { updateSessionAction, type ActionState } from "@/app/actions/sessions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditSessionForm({
  sessionId,
  locations,
  defaults,
  labels,
}: {
  sessionId: string;
  locations: string[];
  defaults: {
    startsAt: string | null;
    location: string | null;
    cost: number;
    capacity: number | null;
  };
  labels: {
    startsAt: string;
    location: string;
    locationPlaceholder: string;
    cost: string;
    capacity: string;
    capacityHint: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSessionAction,
    {},
  );
  const [local, setLocal] = useState(toDatetimeLocalValue(defaults.startsAt));
  const hasVenues = locations.length > 0;
  const [location, setLocation] = useState(defaults.location ?? "");
  const iso = local ? new Date(local).toISOString() : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="starts_at_iso" value={iso} />
      {hasVenues && <input type="hidden" name="location" value={location} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="es_starts" className="text-sm font-medium">
            {labels.startsAt}
          </label>
          <Input
            id="es_starts"
            type="datetime-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.location}</label>
          {hasVenues ? (
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue placeholder={labels.locationPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              name="location"
              maxLength={120}
              defaultValue={defaults.location ?? ""}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="es_cost" className="text-sm font-medium">
            {labels.cost}
          </label>
          <Input
            id="es_cost"
            name="cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.cost}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="es_cap" className="text-sm font-medium">
            {labels.capacity}
          </label>
          <Input
            id="es_cap"
            name="capacity"
            type="number"
            min={1}
            step={1}
            placeholder={labels.capacityHint}
            defaultValue={defaults.capacity ?? ""}
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
