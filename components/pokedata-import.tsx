"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importPokedataEventsAction, type ImportState } from "@/app/actions/pokedata";
import type { Game } from "@/lib/league-format";
import { GameBadge } from "@/components/game-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// One row per event the API returned, already resolved on the server:
// proposed name, store and season league, and why it can or cannot be
// imported. The client only ticks boxes.
export type ImportRow = {
  key: string;
  tournamentId: string | null;
  name: string;
  subtitle: string | null;
  game: Game | null;
  startsAt: string | null; // formatted for display
  shop: string;
  city: string;
  cost: number;
  url: string | null;
  playLeagueId: string | null;
  storeName: string | null;
  leagueName: string | null;
  leagueKind: "one" | "none" | "many" | null;
  state: "ready" | "imported" | "unknownStore" | "unsupported" | "noId";
  existingSlug: string | null;
};

export type ImportLabels = {
  selectAll: string;
  importCta: string; // "Importar seleccionados ({n})"
  importing: string;
  alreadyImported: string;
  view: string;
  unknownStore: string; // "… League ID {id} …"
  unsupported: string;
  noId: string;
  shop: string; // "Tienda en Play!: {shop}"
  store: string; // "Tienda: {name}"
  league: string; // "Liga: {name}"
  leagueNone: string;
  leagueMany: string;
  free: string;
  resultsTitle: string;
  resultOk: string;
  resultError: string;
  playPage: string;
};

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), template);
}

export function PokedataImport({ rows, labels }: { rows: ImportRow[]; labels: ImportLabels }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importPokedataEventsAction,
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // After an import the server re-renders the rows, so anything that went
  // through is now "imported" and drops out of `ready` on its own.
  const ready = rows.filter(
    (r): r is ImportRow & { tournamentId: string } => r.state === "ready" && !!r.tournamentId,
  );
  const readyIds = new Set(ready.map((r) => r.tournamentId));
  const count = [...selected].filter((id) => readyIds.has(id)).length;
  const allSelected = ready.length > 0 && count === ready.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ready.map((r) => r.tournamentId)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.results && state.results.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border p-3">
          <span className="text-sm font-medium">{labels.resultsTitle}</span>
          <ul className="flex flex-col gap-0.5 text-sm">
            {state.results.map((r) => (
              <li key={r.tournamentId} className="flex flex-wrap items-center gap-2">
                <Badge variant={r.ok ? "default" : "destructive"}>
                  {r.ok ? labels.resultOk : labels.resultError}
                </Badge>
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{r.tournamentId}</span>
                {r.ok && r.slug && (
                  <Link href={`/events/${r.slug}`} className="underline">
                    {labels.view}
                  </Link>
                )}
                {!r.ok && r.error && <span className="text-destructive">{r.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          {labels.selectAll}
        </label>
      )}

      <ul className="divide-y">
        {rows.map((r) => {
          const checkable = r.state === "ready" && !!r.tournamentId;
          const checked = checkable && selected.has(r.tournamentId!);
          return (
            <li key={r.key} className="flex flex-wrap items-start gap-3 py-3">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  name="tournament_id"
                  value={r.tournamentId ?? ""}
                  disabled={!checkable}
                  checked={checked}
                  onChange={() => r.tournamentId && toggle(r.tournamentId)}
                  aria-label={r.name}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.game && <GameBadge game={r.game} />}
                  {r.state === "imported" && (
                    <Badge variant="secondary">{labels.alreadyImported}</Badge>
                  )}
                  {r.state === "unknownStore" && (
                    <Badge variant="outline">
                      {fill(labels.unknownStore, { id: r.playLeagueId ?? "?" })}
                    </Badge>
                  )}
                  {r.state === "unsupported" && <Badge variant="outline">{labels.unsupported}</Badge>}
                  {r.state === "noId" && <Badge variant="outline">{labels.noId}</Badge>}
                </div>
                {r.subtitle && r.subtitle !== r.name && (
                  <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                )}
                <span className="text-sm text-muted-foreground">
                  {[r.startsAt, r.cost > 0 ? `${r.cost} €` : labels.free, r.city]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fill(labels.shop, { shop: r.shop })}
                  {r.storeName && ` · ${fill(labels.store, { name: r.storeName })}`}
                  {r.storeName && r.leagueKind === "one" && r.leagueName &&
                    ` · ${fill(labels.league, { name: r.leagueName })}`}
                  {r.storeName && r.leagueKind === "none" && ` · ${labels.leagueNone}`}
                  {r.storeName && r.leagueKind === "many" && ` · ${labels.leagueMany}`}
                </span>
                <span className="flex flex-wrap gap-3 text-xs">
                  {r.tournamentId && (
                    <span className="font-mono text-muted-foreground">{r.tournamentId}</span>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="underline">
                      {labels.playPage}
                    </a>
                  )}
                  {r.existingSlug && (
                    <Link href={`/events/${r.existingSlug}`} className="underline">
                      {labels.view}
                    </Link>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div>
        <Button type="submit" disabled={pending || count === 0}>
          {pending ? labels.importing : fill(labels.importCta, { n: String(count) })}
        </Button>
      </div>
    </form>
  );
}
