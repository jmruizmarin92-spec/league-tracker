"use client";

import { useActionState, useState } from "react";
import { updateLeagueDetailsAction, type ActionState } from "@/app/actions/leagues";
import { FORMATS_BY_GAME, type Game } from "@/lib/league-format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeagueDetailsForm({
  leagueId,
  slug,
  defaults,
  labels,
}: {
  leagueId: string;
  slug: string;
  defaults: {
    name: string;
    subtitle: string | null;
    game: Game;
    format: string | null;
  };
  labels: {
    name: string;
    subtitle: string;
    subtitleHint: string;
    game: string;
    format: string;
    formatPlaceholder: string;
    save: string;
    saved: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateLeagueDetailsAction,
    {},
  );
  const [game, setGame] = useState<Game>(defaults.game);
  const [format, setFormat] = useState(defaults.format ?? "");

  function onGameChange(v: string) {
    const g = v as Game;
    setGame(g);
    if (g === "vgc") setFormat("champions");
    else if (!FORMATS_BY_GAME[g].some((f) => f.value === format)) setFormat("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="game" value={game} />
      <input type="hidden" name="format" value={format} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ld_name" className="text-sm font-medium">
            {labels.name}
          </label>
          <Input id="ld_name" name="name" maxLength={80} defaultValue={defaults.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ld_subtitle" className="text-sm font-medium">
            {labels.subtitle}
          </label>
          <Input
            id="ld_subtitle"
            name="subtitle"
            maxLength={80}
            placeholder={labels.subtitleHint}
            defaultValue={defaults.subtitle ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.game}</label>
          <Select value={game} onValueChange={onGameChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tcg">TCG</SelectItem>
              <SelectItem value="vgc">VGC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.format}</label>
          <Select value={format} onValueChange={setFormat} disabled={game === "vgc"}>
            <SelectTrigger>
              <SelectValue placeholder={labels.formatPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {FORMATS_BY_GAME[game].map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !format}>
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
