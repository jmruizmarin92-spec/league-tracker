"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  setMyArchetypesAction,
  setArchetypeVisibilityAction,
  adminSetParticipantArchetypesAction,
  type ActionState,
} from "@/app/actions/sessions";
import { POKEDEX, spriteUrl } from "@/lib/pokedex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Option = { key: string; name: string; icon: string | null };

function ArchetypeCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  clearLabel,
  noResultsLabel,
}: {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  clearLabel: string;
  noResultsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? options.find((o) => o.key === value) : undefined;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 60);
  }, [query, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="justify-start gap-2 font-normal"
        >
          {selected ? (
            <>
              {selected.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.icon} alt="" className="h-6 w-6" />
              )}
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(18rem,calc(100vw-2rem))] p-0"
        align="start"
      >
        <div className="p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {clearLabel}
          </button>
          {results.length === 0 && query.trim() !== "" && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              {noResultsLabel}
            </p>
          )}
          {results.map((o) => (
            <button
              key={o.key}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onChange(o.key);
                setOpen(false);
                setQuery("");
              }}
            >
              {o.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.icon} alt="" className="h-6 w-6" />
              )}
              <span className="truncate">{o.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ArchetypePicker({
  sessionId,
  playerId,
  customs,
  initial,
  labels,
}: {
  sessionId: string;
  // When set, this edits another participant's picks as a league admin
  // (via admin_set_participant_archetypes) instead of the caller's own.
  playerId?: string;
  customs: { id: string; name: string; icon_url: string | null }[];
  initial: { a1: string; a2: string; isPublic: boolean };
  labels: {
    title: string;
    hint: string;
    slot1: string;
    slot2: string;
    placeholder: string;
    search: string;
    clear: string;
    noResults: string;
    publicLabel: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    playerId ? adminSetParticipantArchetypesAction : setMyArchetypesAction,
    {},
  );
  const [a1, setA1] = useState(initial.a1);
  const [a2, setA2] = useState(initial.a2);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [, startTransition] = useTransition();

  const options = useMemo<Option[]>(() => {
    const pkm = POKEDEX.map((p) => ({
      key: `pkm:${p.id}`,
      name: p.name,
      icon: spriteUrl(p.id),
    }));
    const cst = customs.map((c) => ({
      key: `cst:${c.id}`,
      name: c.name,
      icon: c.icon_url,
    }));
    return [...cst, ...pkm];
  }, [customs]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="session_id" value={sessionId} />
      {playerId && <input type="hidden" name="player_id" value={playerId} />}
      <input type="hidden" name="a1" value={a1} />
      <input type="hidden" name="a2" value={a2} />
      <input type="hidden" name="is_public" value={String(isPublic)} />

      <p className="text-sm text-muted-foreground">{labels.hint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.slot1}</label>
          <ArchetypeCombobox
            options={options}
            value={a1}
            onChange={setA1}
            placeholder={labels.placeholder}
            searchPlaceholder={labels.search}
            clearLabel={labels.clear}
            noResultsLabel={labels.noResults}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.slot2}</label>
          <ArchetypeCombobox
            options={options}
            value={a2}
            onChange={setA2}
            placeholder={labels.placeholder}
            searchPlaceholder={labels.search}
            clearLabel={labels.clear}
            noResultsLabel={labels.noResults}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="arch-public"
          checked={isPublic}
          onCheckedChange={(v) => {
            setIsPublic(v);
            // Self mode gets an instant live toggle; in admin mode the switch
            // just feeds the form and takes effect on save.
            if (!playerId) {
              startTransition(() => setArchetypeVisibilityAction(sessionId, v));
            }
          }}
        />
        <label htmlFor="arch-public" className="text-sm">
          {labels.publicLabel}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state?.ok && <p className="text-sm text-primary">{labels.saved}</p>}
      </div>
    </form>
  );
}
