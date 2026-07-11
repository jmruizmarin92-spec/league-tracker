"use client";

import { useActionState, useState } from "react";
import { createSessionAction, type ActionState } from "@/app/actions/sessions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateSessionForm({
  leagueId,
  slug,
  locations,
  defaultLocation,
  labels,
}: {
  leagueId: string;
  slug: string;
  locations: string[];
  defaultLocation: string | null;
  labels: {
    name: string;
    startsAt: string;
    location: string;
    locationPlaceholder: string;
    cost: string;
    capacity: string;
    capacityHint: string;
    cta: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSessionAction,
    {},
  );
  const [local, setLocal] = useState("");
  const [location, setLocation] = useState(defaultLocation ?? "");
  const iso = local ? new Date(local).toISOString() : "";
  const hasVenues = locations.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="starts_at_iso" value={iso} />
      {hasVenues && <input type="hidden" name="location" value={location} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            {labels.name}
          </label>
          <Input id="name" name="name" maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="starts_at" className="text-sm font-medium">
            {labels.startsAt}
          </label>
          <Input
            id="starts_at"
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
            <Input name="location" maxLength={120} />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cost" className="text-sm font-medium">
            {labels.cost}
          </label>
          <Input
            id="cost"
            name="cost"
            type="number"
            min={0}
            step="0.01"
            defaultValue="0"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="capacity" className="text-sm font-medium">
            {labels.capacity}
          </label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            step={1}
            placeholder={labels.capacityHint}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {labels.cta}
        </Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </form>
  );
}
