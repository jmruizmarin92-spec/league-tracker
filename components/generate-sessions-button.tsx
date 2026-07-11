"use client";

import { useActionState } from "react";
import {
  generateLeagueSessionsAction,
  type GenerateSessionsState,
} from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";

export function GenerateSessionsButton({
  leagueId,
  slug,
  labels,
}: {
  leagueId: string;
  slug: string;
  labels: {
    cta: string;
    created: string;
    none: string;
  };
}) {
  const [state, formAction, pending] = useActionState<
    GenerateSessionsState,
    FormData
  >(generateLeagueSessionsAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {labels.cta}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && state.count != null && (
        <p className="text-sm text-primary">
          {state.count > 0
            ? labels.created.replace("{count}", String(state.count))
            : labels.none}
        </p>
      )}
    </form>
  );
}
