"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "@/app/actions/sessions";
import type { Game } from "@/lib/leagues";
import { POKEDEX, spriteUrl } from "@/lib/pokedex";
import { ArchetypeCombobox } from "@/components/archetype-picker";
import { Button } from "@/components/ui/button";

type Chip = { key: string; name: string; icon: string | null };
type Custom = { id: string; game: Game; name: string; icon_url: string | null };

export type SavedDeck = { id: string; game: Game; chips: Chip[] };

export type SavedDecksLabels = {
  games: Record<Game, string>;
  none: string;
  slot1: string;
  slot2: string;
  placeholder: string;
  search: string;
  clear: string;
  noResults: string;
  add: string;
  added: string;
  delete: string;
};

const GAMES: Game[] = ["tcg", "vgc"];

// Saved decks on /me (PL-3): one block per game with the list (most recent
// first, delete per row) and an add form. Session/event submissions add to
// the same list automatically through their own RPCs.
export function SavedDecksManager({
  decks,
  customs,
  saveAction,
  deleteAction,
  labels,
}: {
  decks: SavedDeck[];
  customs: Custom[];
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  labels: SavedDecksLabels;
}) {
  return (
    <div className="flex flex-col gap-6">
      {GAMES.map((game) => (
        <GameBlock
          key={game}
          game={game}
          decks={decks.filter((d) => d.game === game)}
          customs={customs.filter((c) => c.game === game)}
          saveAction={saveAction}
          deleteAction={deleteAction}
          labels={labels}
        />
      ))}
    </div>
  );
}

function GameBlock({
  game,
  decks,
  customs,
  saveAction,
  deleteAction,
  labels,
}: {
  game: Game;
  decks: SavedDeck[];
  customs: Custom[];
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  labels: SavedDecksLabels;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveAction,
    {},
  );
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");

  const options = useMemo<Chip[]>(() => {
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
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{labels.games[game]}</h3>

      {decks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.none}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {decks.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
                {d.chips.map((c, i) => (
                  <span key={c.key} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground">+</span>}
                    {c.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.icon} alt="" className="h-5 w-5" />
                    )}
                    <span className="truncate">{c.name}</span>
                  </span>
                ))}
              </span>
              <form action={deleteAction}>
                <input type="hidden" name="deck_id" value={d.id} />
                <Button type="submit" variant="ghost" size="sm">
                  {labels.delete}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={(fd) => {
          formAction(fd);
          setA1("");
          setA2("");
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="game" value={game} />
        <input type="hidden" name="a1" value={a1} />
        <input type="hidden" name="a2" value={a2} />
        <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending || (!a1 && !a2)}
          >
            {labels.add}
          </Button>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          {state?.ok && <p className="text-sm text-primary">{labels.added}</p>}
        </div>
      </form>
    </div>
  );
}
