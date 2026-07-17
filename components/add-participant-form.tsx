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
  roundsStarted,
  labels,
}: {
  sessionId: string;
  players: { id: string; label: string }[];
  // True once at least one round exists — enables the late-join options.
  roundsStarted: boolean;
  labels: {
    placeholder: string;
    cta: string;
    lateTitle: string;
    lateHint: string;
    missedNone: string;
    missedLoss: string;
    entryNext: string;
    entryCurrent: string;
    entryBye: string;
  };
}) {
  const [player, setPlayer] = useState("");

  const radio = (name: string, value: string, text: string, checked: boolean) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        className="accent-primary"
      />
      {text}
    </label>
  );

  return (
    <form action={adminAddParticipantAction} className="flex flex-col gap-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="player_id" value={player} />

      <div className="flex flex-col gap-2 sm:flex-row">
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
      </div>

      {roundsStarted && (
        <fieldset className="flex flex-col gap-3 rounded-md border border-dashed p-3">
          <legend className="px-1 text-sm font-medium">{labels.lateTitle}</legend>
          <p className="text-xs text-muted-foreground">{labels.lateHint}</p>
          <div className="flex flex-col gap-1">
            {radio("missed", "none", labels.missedNone, true)}
            {radio("missed", "loss", labels.missedLoss, false)}
          </div>
          <div className="flex flex-col gap-1 border-t pt-2">
            {radio("entry", "next", labels.entryNext, true)}
            {radio("entry", "current", labels.entryCurrent, false)}
            {radio("entry", "bye", labels.entryBye, false)}
          </div>
        </fieldset>
      )}
    </form>
  );
}
