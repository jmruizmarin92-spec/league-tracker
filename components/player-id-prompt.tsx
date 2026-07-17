"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/players";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PlayerIdPrompt({
  action,
  labels,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  labels: {
    title: string;
    description: string;
    placeholder: string;
    save: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  if (state?.ok) return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-accent/30 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">{labels.description}</p>
      </div>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <Input
          name="pokemon_id"
          placeholder={labels.placeholder}
          maxLength={60}
          className="h-9 w-48"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {labels.save}
        </Button>
        {state?.error && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
      </form>
    </section>
  );
}
