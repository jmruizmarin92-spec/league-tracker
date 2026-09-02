"use client";

import { useActionState, useState } from "react";
import {
  guestSubmitListAction,
  guestUpdateListAction,
  type GuestActionState,
} from "@/app/actions/events";
import { guestEntryPath } from "@/lib/event-guest";
import type { GuestEntry } from "@/lib/events";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

type Labels = {
  intro: string;
  name: string;
  namePlaceholder: string;
  pokemonId: string;
  pokemonIdHint: string;
  listLabel: string;
  listPlaceholder: string;
  urlLabel: string;
  urlPlaceholder: string;
  submit: string;
  save: string;
  saved: string;
  submitted: string;
  submittedAs: (name: string, id: string) => string;
  registeredIn: string;
  waitlisted: string;
  linkLabel: string;
  linkHint: string;
  copyLink: string;
  copied: string;
  accountHint: string;
  privateNote: string;
  closed: string;
  entryLocked: string;
  deadlineNote: string | null;
  noList: string;
  openList: string;
};

// Logged-out registration + list for events that allow guests (PL-19). Two
// states: no entry yet (name + Pokémon ID + list form) or an entry found for
// this browser's token (badge, private link, editable list until the cutoff).
// The token reaches us either from the httpOnly cookie (via the server page)
// or straight from the submit action's response, both as props/state.
export function EventGuestRegister({
  slug,
  eventId,
  isOpen,
  locked,
  entry,
  token,
  baseUrl,
  labels,
}: {
  slug: string;
  eventId: string;
  isOpen: boolean;
  locked: boolean;
  entry: GuestEntry | null;
  // The token the server resolved for this viewer (cookie or ?guest=).
  token: string | null;
  // Origin for the private link (the server knows the host; window doesn't
  // exist during SSR). Empty string falls back to a relative link.
  baseUrl: string;
  labels: Labels;
}) {
  const [subState, subAction, subPending] = useActionState<GuestActionState, FormData>(
    guestSubmitListAction,
    {},
  );
  const [updState, updAction, updPending] = useActionState<GuestActionState, FormData>(
    guestUpdateListAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  const activeToken = token ?? subState.token ?? null;
  const link = activeToken ? `${baseUrl}${guestEntryPath(slug, activeToken)}` : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still printed for manual selection.
    }
  };

  const listFields = (contentDefault: string, urlDefault: string) => (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          {labels.listLabel}
          <span className="text-destructive"> *</span>
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

  const privateLink = link && (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3">
      <span className="text-sm font-medium">{labels.linkLabel}</span>
      <code className="break-all text-xs">{link}</code>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
          {copied ? labels.copied : labels.copyLink}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{labels.linkHint}</p>
    </div>
  );

  if (entry) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={entry.status === "registered" ? "default" : "secondary"}>
            {entry.status === "registered" ? labels.registeredIn : labels.waitlisted}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {labels.submittedAs(entry.display_name, entry.pokemon_id ?? "—")}
          </span>
        </div>
        {privateLink}
        {locked ? (
          <>
            <p className="text-sm text-muted-foreground">{labels.entryLocked}</p>
            {submittedList(entry.content, entry.url)}
          </>
        ) : (
          <form action={updAction} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="token" value={activeToken ?? ""} />
            {listFields(entry.content ?? "", entry.url ?? "")}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={updPending}>
                {labels.save}
              </Button>
              {updState?.error && (
                <p className="text-sm text-destructive">{updState.error}</p>
              )}
              {updState?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
            </div>
          </form>
        )}
        <p className="text-xs text-muted-foreground">{labels.accountHint}</p>
      </div>
    );
  }

  // Submitted just now but the page has not re-rendered with the cookie yet
  // (or the browser refused it): still show the link so it is never lost.
  if (subState.ok && subState.token) {
    return (
      <div className="flex flex-col gap-3">
        <Badge>{labels.submitted}</Badge>
        {privateLink}
        <p className="text-xs text-muted-foreground">{labels.accountHint}</p>
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
    <form action={subAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event_id" value={eventId} />
      <p className="text-sm text-muted-foreground">{labels.intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="g_name" className="text-sm font-medium">
            {labels.name}
            <span className="text-destructive"> *</span>
          </label>
          <Input
            id="g_name"
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            placeholder={labels.namePlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="g_pid" className="text-sm font-medium">
            {labels.pokemonId}
            <span className="text-destructive"> *</span>
          </label>
          <Input
            id="g_pid"
            name="pokemon_id"
            required
            inputMode="numeric"
            pattern="[0-9 ]{1,12}"
            maxLength={12}
            placeholder="1234567"
          />
          <p className="text-xs text-muted-foreground">{labels.pokemonIdHint}</p>
        </div>
      </div>
      {listFields("", "")}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={subPending}>
          {labels.submit}
        </Button>
        {subState?.error && <p className="text-sm text-destructive">{subState.error}</p>}
      </div>
    </form>
  );
}
