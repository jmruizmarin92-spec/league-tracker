"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/players";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Values = {
  display_name: string;
  first_name: string;
  last_name: string;
  pokemon_id: string;
  game_id: string;
};

export function PlayerFieldsForm({
  action,
  playerId,
  defaults,
  labels,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  playerId?: string;
  defaults: Values;
  labels: {
    alias: string;
    firstName: string;
    lastName: string;
    pokemonId: string;
    gameId: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  const field = (
    name: keyof Values,
    label: string,
    value: string,
    required = false,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <Input id={name} name={name} defaultValue={value} maxLength={60} />
    </div>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {playerId && <input type="hidden" name="player_id" value={playerId} />}
      {field("display_name", labels.alias, defaults.display_name, true)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("first_name", labels.firstName, defaults.first_name)}
        {field("last_name", labels.lastName, defaults.last_name)}
        {field("pokemon_id", labels.pokemonId, defaults.pokemon_id)}
        {field("game_id", labels.gameId, defaults.game_id)}
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
