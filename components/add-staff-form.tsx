"use client";

import { useState } from "react";
import { addEventStaffAction } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddStaffForm({
  eventId,
  slug,
  players,
  labels,
}: {
  eventId: string;
  slug: string;
  players: { id: string; label: string }[];
  labels: { placeholder: string; rolePlaceholder: string; cta: string };
}) {
  const [player, setPlayer] = useState("");
  const [role, setRole] = useState("");

  return (
    <form action={addEventStaffAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="player_id" value={player} />
      <Select value={player} onValueChange={setPlayer}>
        <SelectTrigger className="sm:flex-1">
          <SelectValue placeholder={labels.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        name="role"
        maxLength={60}
        placeholder={labels.rolePlaceholder}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="sm:w-44"
      />
      <Button type="submit" disabled={!player || !role}>
        {labels.cta}
      </Button>
    </form>
  );
}
