"use client";

import { useActionState } from "react";
import {
  generateRoundAction,
  type GenerateRoundState,
} from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";

/**
 * "Generate round N" for admins. A plain <form action> would swallow the
 * action's result, and generating can legitimately fail — every remaining
 * pairing would be a rematch, which we refuse — so the error has to come back
 * to the button that asked for it.
 */
export function GenerateRoundButton({
  sessionId,
  disabled,
  label,
}: {
  sessionId: string;
  disabled?: boolean;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<
    GenerateRoundState,
    FormData
  >(generateRoundAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <Button type="submit" size="sm" disabled={disabled || pending}>
        {label}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
