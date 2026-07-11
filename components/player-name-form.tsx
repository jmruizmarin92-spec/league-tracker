"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/app/actions/players";

export function PlayerNameForm({
  action,
  placeholder,
  submitLabel,
  defaultValue,
  successLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  placeholder: string;
  submitLabel: string;
  defaultValue?: string;
  successLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="display_name"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={60}
          className="sm:flex-1"
        />
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && successLabel && (
        <p className="text-sm text-primary">{successLabel}</p>
      )}
    </form>
  );
}
