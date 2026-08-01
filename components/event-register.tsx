"use client";

import { useActionState } from "react";
import {
  registerEventAction,
  submitListAction,
  unregisterEventAction,
  type ActionState,
} from "@/app/actions/events";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

type Labels = {
  registeredIn: string;
  waitlisted: string;
  listLabel: string;
  listPlaceholder: string;
  urlLabel: string;
  urlPlaceholder: string;
  listRequiredNote: string;
  register: string;
  save: string;
  saved: string;
  unregister: string;
  closed: string;
  privateNote: string;
  entryLocked: string;
  deadlineNote: string | null;
  noList: string;
  openList: string;
};

export function EventRegister({
  slug,
  eventId,
  isOpen,
  listRequired,
  locked,
  myReg,
  labels,
}: {
  slug: string;
  eventId: string;
  isOpen: boolean;
  listRequired: boolean;
  // Cutoff has passed for this viewer (event admins are passed false — they
  // keep editing after the deadline).
  locked: boolean;
  myReg:
    | { status: "registered" | "waitlisted"; content: string | null; url: string | null }
    | null;
  labels: Labels;
}) {
  const [regState, regAction, regPending] = useActionState<ActionState, FormData>(
    registerEventAction,
    {},
  );
  const [listState, listAction, listPending] = useActionState<ActionState, FormData>(
    submitListAction,
    {},
  );

  const listFields = (
    contentDefault: string,
    urlDefault: string,
    required: boolean,
  ) => (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          {labels.listLabel}
          {required && <span className="text-destructive"> *</span>}
        </label>
        <Textarea
          name="content"
          rows={5}
          defaultValue={contentDefault}
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
          defaultValue={urlDefault}
          placeholder={labels.urlPlaceholder}
          maxLength={500}
        />
      </div>
      <p className="text-xs text-muted-foreground">{labels.privateNote}</p>
      {labels.deadlineNote && (
        <p className="text-xs text-muted-foreground">{labels.deadlineNote}</p>
      )}
    </>
  );

  // Past the cutoff a registered player still sees what they sent, read-only.
  const submittedList = (content: string | null, url: string | null) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{labels.listLabel}</span>
      {content ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">
          {content}
        </pre>
      ) : (
        !url && <p className="text-sm text-muted-foreground">{labels.noList}</p>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" />
          {labels.openList}
        </a>
      )}
    </div>
  );

  if (myReg) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={myReg.status === "registered" ? "default" : "secondary"}>
            {myReg.status === "registered" ? labels.registeredIn : labels.waitlisted}
          </Badge>
          <form action={unregisterEventAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event_id" value={eventId} />
            <Button type="submit" variant="outline" size="sm">
              {labels.unregister}
            </Button>
          </form>
        </div>
        {locked ? (
          <>
            <p className="text-sm text-muted-foreground">{labels.entryLocked}</p>
            {submittedList(myReg.content, myReg.url)}
          </>
        ) : (
          <form action={listAction} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event_id" value={eventId} />
            {listFields(myReg.content ?? "", myReg.url ?? "", false)}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={listPending}>
                {labels.save}
              </Button>
              {listState?.error && (
                <p className="text-sm text-destructive">{listState.error}</p>
              )}
              {listState?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
            </div>
          </form>
        )}
      </div>
    );
  }

  if (locked) {
    return <p className="text-sm text-muted-foreground">{labels.entryLocked}</p>;
  }

  if (!isOpen) {
    return <p className="text-sm text-muted-foreground">{labels.closed}</p>;
  }

  return (
    <form action={regAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event_id" value={eventId} />
      {listRequired && (
        <p className="text-sm text-muted-foreground">{labels.listRequiredNote}</p>
      )}
      {listFields("", "", listRequired)}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={regPending}>
          {labels.register}
        </Button>
        {regState?.error && (
          <p className="text-sm text-destructive">{regState.error}</p>
        )}
      </div>
    </form>
  );
}
