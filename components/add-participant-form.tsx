"use client";

import { useState } from "react";
import { adminAddParticipantAction } from "@/app/actions/sessions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddParticipantForm({
  sessionId,
  players,
  labels,
}: {
  sessionId: string;
  players: { id: string; label: string }[];
  labels: { placeholder: string; cta: string };
}) {
  const [player, setPlayer] = useState("");

  return (
    <form
      action={adminAddParticipantAction}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <input type="hidden" name="session_id" value={sessionId} />
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
      <Button type="submit" disabled={!player}>
        {labels.cta}
      </Button>
    </form>
  );
}
