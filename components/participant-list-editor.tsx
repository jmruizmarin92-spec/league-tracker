"use client";

import { useActionState, useState } from "react";
import { adminSubmitListAction, type ActionState } from "@/app/actions/events";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

// Admin-only inline view + editor for a single registrant's list. Unlike the
// player's own form this ignores the entry cutoff (admin_submit_event_list,
// 0039), so lists can still be fixed or entered at the venue.
export function ParticipantListEditor({
  slug,
  eventId,
  playerId,
  initial,
  labels,
}: {
  slug: string;
  eventId: string;
  playerId: string;
  initial: { content: string | null; url: string | null };
  labels: {
    viewList: string;
    openList: string;
    noList: string;
    edit: string;
    close: string;
    listLabel: string;
    listPlaceholder: string;
    urlLabel: string;
    urlPlaceholder: string;
    save: string;
    saved: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    adminSubmitListAction,
    {},
  );
  const hasList = !!(initial.content || initial.url);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        {hasList ? (
          <details className="min-w-0 flex-1 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {labels.viewList}
            </summary>
            {initial.content && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">
                {initial.content}
              </pre>
            )}
            {initial.url && (
              <a
                href={initial.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex w-fit items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                {labels.openList}
              </a>
            )}
          </details>
        ) : (
          <span className="text-sm text-muted-foreground">{labels.noList}</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? labels.close : labels.edit}
        </Button>
      </div>

      {open && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="player_id" value={playerId} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{labels.listLabel}</label>
            <Textarea
              name="content"
              rows={5}
              defaultValue={initial.content ?? ""}
              placeholder={labels.listPlaceholder}
              maxLength={20000}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{labels.urlLabel}</label>
            <Input
              name="url"
              type="url"
              defaultValue={initial.url ?? ""}
              placeholder={labels.urlPlaceholder}
              maxLength={500}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {labels.save}
            </Button>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            {state?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
