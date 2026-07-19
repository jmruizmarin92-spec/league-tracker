"use client";

import { useState } from "react";
import { ArchetypePicker } from "@/components/archetype-picker";
import { Button } from "@/components/ui/button";
import type { ArchetypeChip } from "@/lib/archetypes";
import type { ActionState } from "@/app/actions/sessions";

// Admin-only inline editor for a single participant's archetype picks,
// shown collapsed as a chip summary with an "edit" toggle.
export function ParticipantArchetypeEditor({
  contextId,
  contextIdField,
  playerId,
  customs,
  initial,
  chips,
  action,
  adminAction,
  extraFields,
  labels,
}: {
  contextId: string;
  contextIdField: string;
  playerId: string;
  customs: { id: string; name: string; icon_url: string | null }[];
  initial: { a1: string; a2: string; isPublic: boolean };
  chips: ArchetypeChip[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  adminAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  extraFields?: Record<string, string>;
  labels: {
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
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {chips.length > 0 ? (
            chips.map((c) => (
              <span key={c.key} className="flex items-center gap-1">
                {c.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" className="h-5 w-5" />
                )}
                {c.name}
              </span>
            ))
          ) : (
            <span>{labels.none}</span>
          )}
        </div>
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
        <ArchetypePicker
          contextId={contextId}
          contextIdField={contextIdField}
          playerId={playerId}
          customs={customs}
          initial={initial}
          action={action}
          adminAction={adminAction}
          extraFields={extraFields}
          labels={labels}
        />
      )}
    </div>
  );
}
