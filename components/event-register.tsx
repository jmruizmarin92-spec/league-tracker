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
};

export function EventRegister({
  slug,
  eventId,
  isOpen,
  listRequired,
  myReg,
  labels,
}: {
  slug: string;
  eventId: string;
  isOpen: boolean;
  listRequired: boolean;
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
    </>
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
      </div>
    );
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
