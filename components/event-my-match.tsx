"use client";

import { Trophy } from "lucide-react";
import { reportEventMatchAction } from "@/app/actions/event-tdf";
import type {
  EventOfficialResult,
  EventReportedResult,
} from "@/lib/event-rounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type EventMyMatchView = {
  id: string;
  roundLabel: string;
  table: number | null;
  opponentName: string | null; // null = bye
  iAmP1: boolean;
  official: EventOfficialResult;
  reported: EventReportedResult;
};

// The one thing a player opens their phone for: which table, against whom.
// Pinned above the pairings list so nobody has to hunt for their own row.
export function EventMyMatch({
  slug,
  match,
  labels,
}: {
  slug: string;
  match: EventMyMatchView;
  labels: {
    title: string;
    tableLabel: string;
    vs: string;
    win: string;
    draw: string;
    lose: string;
    bye: string;
    youWon: string;
    youLost: string;
    youDrew: string;
    doubleLoss: string;
    reportHint: string;
    reportedYouWon: string;
    reportedYouLost: string;
    reportedDraw: string;
  };
}) {
  const { iAmP1, official, reported, opponentName } = match;
  const mine = (r: EventReportedResult | EventOfficialResult) =>
    (iAmP1 && r === "p1_win") || (!iAmP1 && r === "p2_win");
  const theirs = (r: EventReportedResult | EventOfficialResult) =>
    (iAmP1 && r === "p2_win") || (!iAmP1 && r === "p1_win");

  const iWon = mine(official);
  const iLost = theirs(official);
  const decided = official !== "pending" && official !== "bye";

  // Player-centric buttons, mapped to the p1/p2 shape the RPC stores.
  const winValue = iAmP1 ? "p1_win" : "p2_win";
  const loseValue = iAmP1 ? "p2_win" : "p1_win";

  const reportButton = (value: "p1_win" | "p2_win" | "draw", text: string) => (
    <form action={reportEventMatchAction} className="flex-1">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="match_id" value={match.id} />
      <input type="hidden" name="result" value={value} />
      <Button
        type="submit"
        variant={reported === value ? "default" : "outline"}
        className="w-full"
      >
        {text}
      </Button>
    </form>
  );

  return (
    <Card className="border-primary/40 bg-accent/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{labels.title}</CardTitle>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{match.roundLabel}</Badge>
            {match.table != null && (
              <Badge variant="outline">
                {labels.tableLabel} {match.table}
              </Badge>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {opponentName == null ? (
          <Badge variant="secondary" className="w-fit">
            {labels.bye}
          </Badge>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2 text-lg">
              <span className="text-muted-foreground">{labels.vs}</span>
              {iLost && <Trophy className="h-4 w-4 text-primary" />}
              <span
                className={`min-w-0 flex-1 truncate ${iWon ? "text-muted-foreground" : "font-semibold"}`}
                title={opponentName}
              >
                {opponentName}
              </span>
            </p>

            {decided ? (
              <Badge
                variant={iWon ? "default" : "outline"}
                className="w-fit text-sm"
              >
                {official === "double_loss"
                  ? labels.doubleLoss
                  : iWon
                    ? labels.youWon
                    : iLost
                      ? labels.youLost
                      : labels.youDrew}
              </Badge>
            ) : (
              <>
                <div className="flex gap-2">
                  {reportButton(winValue, labels.win)}
                  {reportButton("draw", labels.draw)}
                  {reportButton(loseValue, labels.lose)}
                </div>
                {reported ? (
                  // Deliberately worded as "you said", not "you won": TOM has
                  // the last word and this is only a heads-up for the judge.
                  <p className="text-sm text-muted-foreground">
                    {mine(reported)
                      ? labels.reportedYouWon
                      : theirs(reported)
                        ? labels.reportedYouLost
                        : labels.reportedDraw}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {labels.reportHint}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
