"use client";

import { useActionState } from "react";
import {
  createCustomArchetypeAction,
  type ActionState,
} from "@/app/actions/archetypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomArchetypeForm({
  game,
  labels,
}: {
  game: "tcg" | "vgc";
  labels: { name: string; iconUrl: string; cta: string };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCustomArchetypeAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="game" value={game} />
      <Input name="name" placeholder={labels.name} maxLength={60} className="sm:flex-1" />
      <Input
        name="icon_url"
        placeholder={labels.iconUrl}
        maxLength={500}
        className="sm:flex-1"
      />
      <Button type="submit" disabled={pending}>
        {labels.cta}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive sm:self-center">{state.error}</p>
      )}
    </form>
  );
}
