"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { reportEventMatchAction } from "@/app/actions/event-tdf";
import type {
  EventOfficialResult,
  EventReportedResult,
} from "@/lib/event-rounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EventMatchView = {
  id: string;
  table: number | null;
  p1Name: string;
  p2Name: string | null; // null = bye
  official: EventOfficialResult;
  reported: EventReportedResult;
  isMine: boolean;
  canReport: boolean;
};

export type EventRoundView = {
  id: string;
  label: string;
  matches: EventMatchView[];
};

export type EventDivisionView = {
  key: string;
  label: string;
  rounds: EventRoundView[];
};

export type EventPairingLabels = {
  bye: string;
  draw: string;
  doubleLoss: string;
  vs: string;
  tableLabel: string;
  mine: string;
  win: string;
  unconfirmed: string;
  noPairings: string;
};

// Mirror of what TOM has, plus the one thing players can do from their seat:
// say who won. A report is drawn exactly like a session result — trophy on the
// winner, loser muted — because that is what the TO reads off the screen to key
// into TOM. It never overwrites the official result: the next .tdf drop settles
// the round, and until then the row carries the "sin confirmar" badge.
export function EventPairings({
  slug,
  divisions,
  labels,
}: {
  slug: string;
  divisions: EventDivisionView[];
  labels: EventPairingLabels;
}) {
  if (divisions.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.noPairings}</p>;
  }

  // Age divisions run as parallel tournaments, so they only get their own tab
  // strip when the event actually has more than one.
  if (divisions.length === 1) {
    return <RoundTabs slug={slug} division={divisions[0]} labels={labels} />;
  }

  return (
    <Tabs defaultValue={divisions[0].key} className="gap-4">
      <div className="overflow-x-auto">
        <TabsList>
          {divisions.map((d) => (
            <TabsTrigger key={d.key} value={d.key}>
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {divisions.map((d) => (
        <TabsContent key={d.key} value={d.key}>
          <RoundTabs slug={slug} division={d} labels={labels} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function RoundTabs({
  slug,
  division,
  labels,
}: {
  slug: string;
  division: EventDivisionView;
  labels: EventPairingLabels;
}) {
  // Controlled, not defaultValue: a re-import (or a realtime refresh) adds a
  // round and the view has to follow the room to it. Reconciled during render
  // rather than in an effect — an effect would paint the old round first, and
  // manual selection inside the same set of rounds is kept either way.
  const latest = division.rounds[division.rounds.length - 1]?.id;
  const [active, setActive] = useState(latest);
  const [seenLatest, setSeenLatest] = useState(latest);
  if (latest !== seenLatest) {
    setSeenLatest(latest);
    setActive(latest);
  }

  if (division.rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.noPairings}</p>;
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="gap-4">
      <div className="overflow-x-auto">
        <TabsList>
          {division.rounds.map((r) => (
            <TabsTrigger key={r.id} value={r.id}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {division.rounds.map((round) => (
        <TabsContent key={round.id} value={round.id}>
          <ul className="flex flex-col gap-2">
            {round.matches.map((m) => (
              <li
                key={m.id}
                className={`rounded-md border px-2 py-2 ${m.isMine ? "bg-accent/60" : ""}`}
              >
                <MatchRow slug={slug} match={m} labels={labels} />
              </li>
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function MatchRow({
  slug,
  match,
  labels,
}: {
  slug: string;
  match: EventMatchView;
  labels: EventPairingLabels;
}) {
  const { official, reported } = match;
  const decided = official !== "pending" && official !== "bye";
  // While TOM hasn't ruled, the table's own word stands in for the result. Same
  // shape as a session match from here on — only the badge says it's a report.
  const shown = decided ? official : reported;
  const provisional = !decided && !!reported;
  const nameClass = (won: boolean) =>
    won
      ? "font-semibold text-primary"
      : shown
        ? "text-muted-foreground"
        : undefined;

  if (!match.p2Name) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="min-w-0 flex-1 truncate" title={match.p1Name}>
          {match.p1Name}
        </span>
        <Badge variant="secondary">{labels.bye}</Badge>
        {match.isMine && <Badge variant="outline">{labels.mine}</Badge>}
      </span>
    );
  }

  const reportButton = (value: "p1_win" | "draw" | "p2_win", text: string) => (
    <form action={reportEventMatchAction} className="w-full">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="match_id" value={match.id} />
      <input type="hidden" name="result" value={value} />
      <Button
        type="submit"
        variant={shown === value ? "default" : "outline"}
        size="sm"
        className="w-full"
      >
        {text}
      </Button>
    </form>
  );

  return (
    <>
      {match.table != null && (
        <div className="mb-1.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {labels.tableLabel} {match.table}
        </div>
      )}
      <div className="grid grid-cols-3 items-stretch gap-2 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="flex w-full min-w-0 items-center justify-center gap-1 text-sm">
            {shown === "p1_win" && (
              <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <span
              className={`min-w-0 truncate ${nameClass(shown === "p1_win") ?? ""}`}
              title={match.p1Name}
            >
              {match.p1Name}
            </span>
          </span>
          {match.canReport && reportButton("p1_win", labels.win)}
        </div>

        <div className="flex flex-col items-center gap-2">
          {shown === "draw" && !match.canReport ? (
            <Badge variant="outline">{labels.draw}</Badge>
          ) : official === "double_loss" ? (
            <Badge variant="outline">{labels.doubleLoss}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{labels.vs}</span>
          )}
          {match.canReport && reportButton("draw", labels.draw)}
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="flex w-full min-w-0 items-center justify-center gap-1 text-sm">
            {shown === "p2_win" && (
              <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <span
              className={`min-w-0 truncate ${nameClass(shown === "p2_win") ?? ""}`}
              title={match.p2Name}
            >
              {match.p2Name}
            </span>
          </span>
          {match.canReport && reportButton("p2_win", labels.win)}
        </div>

        {(match.isMine || provisional) && (
          <div className="col-span-3 flex flex-wrap justify-center gap-1.5">
            {match.isMine && <Badge variant="outline">{labels.mine}</Badge>}
            {/* Drops off the moment the next import lands the official result —
                by then the report has been keyed in and is just noise. */}
            {provisional && <Badge variant="secondary">{labels.unconfirmed}</Badge>}
          </div>
        )}
      </div>
    </>
  );
}
