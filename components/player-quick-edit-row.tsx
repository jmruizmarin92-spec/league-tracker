"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionState } from "@/app/actions/players";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

export function PlayerQuickEditRow({
  player,
  quickEditAction,
  deleteAction,
  labels,
}: {
  player: {
    id: string;
    display_name: string;
    user_id: string | null;
    pokemon_id: string | null;
    game_id: string | null;
  };
  quickEditAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  deleteAction: (fd: FormData) => void | Promise<void>;
  labels: {
    badgeLinked: string;
    badgeManaged: string;
    pokemonId: string;
    gameId: string;
    save: string;
    saved: string;
    edit: string;
    delete: string;
    confirmDelete: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    quickEditAction,
    {},
  );

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{player.display_name}</span>
          <Badge variant={player.user_id ? "default" : "secondary"}>
            {player.user_id ? labels.badgeLinked : labels.badgeManaged}
          </Badge>
        </span>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/players/${player.id}`}>{labels.edit}</Link>
          </Button>
          {!player.user_id && (
            <form action={deleteAction}>
              <input type="hidden" name="player_id" value={player.id} />
              <ConfirmDeleteButton confirmMessage={labels.confirmDelete}>
                {labels.delete}
              </ConfirmDeleteButton>
            </form>
          )}
        </div>
      </div>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="player_id" value={player.id} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {labels.pokemonId}
          </label>
          <Input
            name="pokemon_id"
            defaultValue={player.pokemon_id ?? ""}
            maxLength={60}
            className="h-8 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            {labels.gameId}
          </label>
          <Input
            name="game_id"
            defaultValue={player.game_id ?? ""}
            maxLength={60}
            className="h-8 w-36"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {labels.save}
        </Button>
        {state?.error && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
        {state?.ok && <p className="text-xs text-primary">{labels.saved}</p>}
      </form>
    </li>
  );
}
