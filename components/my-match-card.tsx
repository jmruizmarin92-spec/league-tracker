"use client";

import { Trophy } from "lucide-react";
import { reportMatchAction } from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type MyMatch = {
  id: string;
  roundNumber: number;
  table: number | null;
  opponentName: string | null; // null = bye / loss
  iAmP1: boolean;
  result: "pending" | "p1_win" | "p2_win" | "draw" | "bye" | "loss";
};

export function MyMatchCard({
  sessionId,
  match,
  labels,
}: {
  sessionId: string;
  match: MyMatch;
  labels: {
    title: string;
    roundWord: string;
    tableLabel: string;
    vs: string;
    win: string;
    draw: string;
    lose: string;
    bye: string;
    loss: string;
    youWon: string;
    youLost: string;
    youDrew: string;
  };
}) {
  const { iAmP1, result, opponentName } = match;
  const iWon =
    (iAmP1 && result === "p1_win") || (!iAmP1 && result === "p2_win");
  const iLost =
    (iAmP1 && result === "p2_win") || (!iAmP1 && result === "p1_win");

  // Map a player-centric outcome to the p1/p2 result the RPC expects.
  const winResult = iAmP1 ? "p1_win" : "p2_win";
  const loseResult = iAmP1 ? "p2_win" : "p1_win";

  const reportButton = (value: string, text: string, active: boolean) => (
    <form action={reportMatchAction} className="flex-1">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="match_id" value={match.id} />
      <input type="hidden" name="result" value={value} />
      <Button
        type="submit"
        variant={active ? "default" : "outline"}
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
            <Badge variant="secondary">
              {labels.roundWord} {match.roundNumber}
            </Badge>
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
          // Bye or missed-round loss: nothing to report.
          <div className="flex items-center gap-2">
            <Badge variant={result === "loss" ? "outline" : "secondary"}>
              {result === "loss" ? labels.loss : labels.bye}
            </Badge>
          </div>
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

            {result === "pending" ? (
              <div className="flex gap-2">
                {reportButton(winResult, labels.win, false)}
                {reportButton("draw", labels.draw, false)}
                {reportButton(loseResult, labels.lose, false)}
              </div>
            ) : (
              <Badge
                variant={iWon ? "default" : "outline"}
                className="w-fit text-sm"
              >
                {iWon ? labels.youWon : iLost ? labels.youLost : labels.youDrew}
              </Badge>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
