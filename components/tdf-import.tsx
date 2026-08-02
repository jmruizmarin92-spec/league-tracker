"use client";

import { useActionState, useState } from "react";
import {
  previewTdfAction,
  importTdfAction,
  type TdfPreview,
  type TdfPreviewState,
  type TdfImportState,
  type TdfPreviewPlayer,
} from "@/app/actions/event-tdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TdfImportLabels = {
  hint: string;
  pick: string;
  read: string;
  reading: string;
  reviewTitle: string;
  playersTitle: string;
  playersHint: string;
  createNew: string;
  sourceMapped: string;
  sourcePokemonId: string;
  sourceName: string;
  sourceNone: string;
  roundsTitle: string;
  roundLabel: string;
  matchesLabel: string;
  confirm: string;
  importing: string;
  cancel: string;
  imported: string;
};

const SOURCE_LABEL: Record<
  TdfPreviewPlayer["source"],
  keyof Pick<
    TdfImportLabels,
    "sourceMapped" | "sourcePokemonId" | "sourceName" | "sourceNone"
  >
> = {
  mapped: "sourceMapped",
  pokemon_id: "sourcePokemonId",
  name: "sourceName",
  none: "sourceNone",
};

// Radix Select has no empty-string item value, so "create a new player" needs a
// sentinel; the hidden input turns it back into the "" the action expects.
const NEW_PLAYER = "__new__";

// Two steps on purpose. Step one parses and shows what the file would do; step
// two commits it. The gap is where the TO fixes the only thing the machine
// can't get right on its own — which "David Pérez" in the database is the
// David Pérez in the file.
export function TdfImport({
  eventId,
  slug,
  labels,
}: {
  eventId: string;
  slug: string;
  labels: TdfImportLabels;
}) {
  const [preview, previewAction, previewing] = useActionState<
    TdfPreviewState,
    FormData
  >(previewTdfAction, {});
  const [imported, importAction, importing] = useActionState<
    TdfImportState,
    FormData
  >(importTdfAction, {});

  // Per-userid override of the suggested player.
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [fileKey, setFileKey] = useState(0);
  // useActionState keeps the last result forever, so a fresh file read has to
  // mark the previous import as stale — otherwise the success message from the
  // last round would swallow the review step for the next one.
  const [lastPreview, setLastPreview] = useState<TdfPreview | undefined>();
  const [staleImport, setStaleImport] = useState<TdfImportState | null>(null);
  const [discarded, setDiscarded] = useState(false);

  if (preview.preview !== lastPreview) {
    setLastPreview(preview.preview);
    setStaleImport(imported);
    setChoices({});
    setDiscarded(false);
  }

  const p = preview.preview;
  const done = !!imported.ok && imported !== staleImport;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.hint}</p>

      <form action={previewAction} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="event_id" value={eventId} />
        <input
          key={fileKey}
          type="file"
          name="file"
          accept=".tdf,.xml,text/xml,application/xml"
          aria-label={labels.pick}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        <Button type="submit" variant="secondary" disabled={previewing}>
          {previewing ? labels.reading : labels.read}
        </Button>
      </form>

      {preview.error && (
        <p className="text-sm text-destructive">{preview.error}</p>
      )}

      {done && (
        <p className="text-sm text-muted-foreground">
          {labels.imported} {imported.summary}
        </p>
      )}

      {p && !done && !discarded && (
        <form action={importAction} className="flex flex-col gap-4 border-t pt-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="file_name" value={p.fileName} />
          <input type="hidden" name="xml" value={p.xml} />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{labels.reviewTitle}</span>
            <p className="text-sm text-muted-foreground">
              {[p.name, p.tdfId, p.startDate, p.city, p.organizer]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{labels.roundsTitle}</span>
            {p.rounds.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {p.rounds.map((r, i) => (
                  <li key={`${r.label}-${r.number}-${i}`}>
                    <Badge variant="outline">
                      {r.label} · {labels.roundLabel} {r.number} · {r.matches}{" "}
                      {labels.matchesLabel}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {labels.playersTitle} ({p.players.length})
            </span>
            <p className="text-sm text-muted-foreground">{labels.playersHint}</p>
            <ul className="flex flex-col divide-y">
              {p.players.map((player) => {
                const value =
                  choices[player.userid] ?? player.playerId ?? NEW_PLAYER;
                return (
                  <li
                    key={player.userid}
                    className="flex flex-col gap-1.5 py-2 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{player.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {player.userid} · {labels[SOURCE_LABEL[player.source]]}
                      </span>
                    </span>
                    <input
                      type="hidden"
                      name={`player_${player.userid}`}
                      value={value === NEW_PLAYER ? "" : value}
                    />
                    <Select
                      value={value}
                      onValueChange={(v) =>
                        setChoices((c) => ({ ...c, [player.userid]: v }))
                      }
                    >
                      <SelectTrigger className="sm:w-72">
                        <SelectValue placeholder={labels.createNew} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW_PLAYER}>
                          {labels.createNew}
                        </SelectItem>
                        {p.candidates.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
          </div>

          {imported.error && (
            <p className="text-sm text-destructive">{imported.error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={importing}>
              {importing ? labels.importing : labels.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDiscarded(true);
                setFileKey((k) => k + 1);
              }}
              disabled={importing}
            >
              {labels.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
