"use client";

import { useActionState, useState } from "react";
import { createLeagueAction, type ActionState } from "@/app/actions/leagues";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateLeagueForm({
  labels,
}: {
  labels: {
    name: string;
    game: string;
    gamePlaceholder: string;
    description: string;
    cta: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLeagueAction,
    {},
  );
  const [game, setGame] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="game" value={game} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {labels.name}
        </label>
        <Input id="name" name="name" maxLength={80} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{labels.game}</label>
        <Select value={game} onValueChange={setGame}>
          <SelectTrigger>
            <SelectValue placeholder={labels.gamePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tcg">TCG</SelectItem>
            <SelectItem value="vgc">VGC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          {labels.description}
        </label>
        <Input id="description" name="description" maxLength={200} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !game}>
          {labels.cta}
        </Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </form>
  );
}
