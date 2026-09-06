"use client";

import { useActionState } from "react";
import {
  importTdfAction,
  type TdfImportState,
} from "@/app/actions/event-tdf";
import { Button } from "@/components/ui/button";

export type TdfImportLabels = {
  hint: string;
  pick: string;
  confirm: string;
  importing: string;
};

// One step on purpose (PL-26): pick the file, import, land on the pairings.
// Players resolve on the server — existing mapping, then Pokémon ID, then an
// unambiguous name, else a new managed player — so the TO only sees this form
// again when the file can't be read or the commit fails. A successful import
// redirects, which is why there is no success state to render here.
export function TdfImport({
  eventId,
  slug,
  labels,
}: {
  eventId: string;
  slug: string;
  labels: TdfImportLabels;
}) {
  const [state, action, pending] = useActionState<TdfImportState, FormData>(
    importTdfAction,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.hint}</p>

      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="slug" value={slug} />
        <input
          type="file"
          name="file"
          accept=".tdf,.xml,text/xml,application/xml"
          aria-label={labels.pick}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? labels.importing : labels.confirm}
        </Button>
      </form>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
