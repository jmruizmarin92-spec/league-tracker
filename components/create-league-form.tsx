"use client";

import { useActionState, useState } from "react";
import { createLeagueAction, type ActionState } from "@/app/actions/leagues";
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

// "2026-01" + 2 -> "2026-03" (a typical 3-month season, inclusive).
function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function CreateLeagueForm({
  labels,
}: {
  labels: {
    name: string;
    game: string;
    gamePlaceholder: string;
    format: string;
    formatPlaceholder: string;
    description: string;
    startMonth: string;
    endMonth: string;
    cta: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLeagueAction,
    {},
  );
  const [game, setGame] = useState("");
  const [format, setFormat] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");

  const formatOptions = game ? FORMATS_BY_GAME[game as Game] : [];

  function onGameChange(v: string) {
    setGame(v);
    // VGC has exactly one valid format; TCG format resets if it no longer applies.
    if (v === "vgc") setFormat("champions");
    else if (!FORMATS_BY_GAME[v as Game]?.some((f) => f.value === format)) {
      setFormat("");
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="game" value={game} />
      <input type="hidden" name="format" value={format} />
      <input
        type="hidden"
        name="starts_month"
        value={startMonth ? `${startMonth}-01` : ""}
      />
      <input
        type="hidden"
        name="ends_month"
        value={endMonth ? `${endMonth}-01` : ""}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {labels.name}
        </label>
        <Input id="name" name="name" maxLength={80} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.game}</label>
          <Select value={game} onValueChange={onGameChange}>
            <SelectTrigger>
              <SelectValue placeholder={labels.gamePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tcg">TCG</SelectItem>
              <SelectItem value="vgc">VGC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{labels.format}</label>
          <Select
            value={format}
            onValueChange={setFormat}
            disabled={!game || game === "vgc"}
          >
            <SelectTrigger>
              <SelectValue placeholder={labels.formatPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {formatOptions.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="start_month" className="text-sm font-medium">
            {labels.startMonth}
          </label>
          <Input
            id="start_month"
            type="month"
            value={startMonth}
            onChange={(e) => {
              const v = e.target.value;
              setStartMonth(v);
              if (v && !endMonth) setEndMonth(addMonths(v, 2));
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="end_month" className="text-sm font-medium">
            {labels.endMonth}
          </label>
          <Input
            id="end_month"
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          {labels.description}
        </label>
        <Input id="description" name="description" maxLength={200} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !game || !format}>
          {labels.cta}
        </Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </form>
  );
}
