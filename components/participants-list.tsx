"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArchetypePicker } from "@/components/archetype-picker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ArchetypeChip } from "@/lib/archetypes";
import type { ActionState } from "@/app/actions/sessions";

// One participant as laid out by the roster: check-in, name, ID, archetypes,
// actions. Shared by league sessions and standalone events.
export type ParticipantRowData = {
  playerId: string;
  name: ReactNode;
  // Pokémon ID from the player's profile, shown next to the name so the TO can
  // match the person in front of them against the tournament software.
  pokemonId?: string | null;
  checkedIn: boolean;
  chips: ArchetypeChip[];
  initial: { a1: string; a2: string; isPublic: boolean };
  // Server-rendered admin actions (e.g. the remove form) for the last column.
  actions?: ReactNode;
  // Extra server-rendered block under the row (e.g. the event list editor).
  extra?: ReactNode;
};

type Labels = {
  checkedIn: string;
  edit: string;
  close: string;
  none: string;
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
  noPokemonId?: string;
};

type SharedProps = {
  // The session/event id this roster belongs to, and the hidden-field name the
  // archetype picker posts it under.
  contextId: string;
  contextIdField?: string;
  customs: { id: string; name: string; icon_url: string | null }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  adminAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  extraFields?: Record<string, string>;
  labels: Labels;
};

export function ParticipantsList({
  rows,
  setCheckedInAction,
  // When set, renders a "pending check-in only" filter above the list.
  filterLabel,
  emptyFilteredLabel,
  ...shared
}: SharedProps & {
  rows: ParticipantRowData[];
  setCheckedInAction: (
    contextId: string,
    playerId: string,
    checkedIn: boolean,
  ) => Promise<void>;
  filterLabel?: string;
  emptyFilteredLabel?: string;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.playerId, r.checkedIn])),
  );
  const [pendingOnly, setPendingOnly] = useState(false);
  const [, startTransition] = useTransition();

  const isChecked = (id: string) => checked[id] ?? false;
  const toggle = (id: string, value: boolean) => {
    setChecked((prev) => ({ ...prev, [id]: value }));
    startTransition(() => setCheckedInAction(shared.contextId, id, value));
  };

  const visible = pendingOnly ? rows.filter((r) => !isChecked(r.playerId)) : rows;
  const filterId = `pending-only-${shared.contextId}-${rows[0]?.playerId ?? "x"}`;

  return (
    <div className="flex flex-col gap-2">
      {filterLabel && (
        <div className="flex items-center gap-2">
          <Switch
            id={filterId}
            size="sm"
            checked={pendingOnly}
            onCheckedChange={setPendingOnly}
          />
          <label htmlFor={filterId} className="text-sm text-muted-foreground">
            {filterLabel}
          </label>
        </div>
      )}
      {visible.length === 0 && pendingOnly ? (
        <p className="py-2 text-sm text-muted-foreground">
          {emptyFilteredLabel}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {visible.map((row) => (
            <ParticipantRow
              key={row.playerId}
              row={row}
              checked={isChecked(row.playerId)}
              onCheckedChange={(v) => toggle(row.playerId, v)}
              {...shared}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ParticipantRow({
  row,
  checked,
  onCheckedChange,
  contextId,
  contextIdField = "session_id",
  customs,
  action,
  adminAction,
  extraFields,
  labels,
}: SharedProps & {
  row: ParticipantRowData;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const checkId = `checked-in-${row.playerId}`;
  const showId = row.pokemonId !== undefined;

  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Switch
          id={checkId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={labels.checkedIn}
          className="shrink-0"
        />
        <span className="flex min-w-0 flex-1 basis-32 flex-col">
          <span className="truncate">{row.name}</span>
          {showId && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {row.pokemonId?.trim() || labels.noPokemonId}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 basis-32 flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {row.chips.length > 0 ? (
            row.chips.map((c) => (
              <span key={c.key} className="flex min-w-0 items-center gap-1">
                {c.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" className="h-5 w-5 shrink-0" />
                )}
                <span className="truncate">{c.name}</span>
              </span>
            ))
          ) : (
            <span>{labels.none}</span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? labels.close : labels.edit}
          </Button>
          {row.actions}
        </div>
      </div>
      {open && (
        <ArchetypePicker
          contextId={contextId}
          contextIdField={contextIdField}
          playerId={row.playerId}
          customs={customs}
          initial={row.initial}
          action={action}
          adminAction={adminAction}
          extraFields={extraFields}
          labels={labels}
        />
      )}
      {row.extra}
    </li>
  );
}
