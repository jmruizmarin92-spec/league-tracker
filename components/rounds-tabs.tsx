"use client";

import { Trophy } from "lucide-react";
import { reportMatchAction, deleteRoundAction } from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MatchView = {
  id: string;
  p1Name: string;
  p2Name: string | null; // null = bye
  result: "pending" | "p1_win" | "p2_win" | "draw" | "bye";
  canReport: boolean;
  isMine: boolean;
};

export type RoundView = {
  id: string;
  number: number;
  isLast: boolean;
  matches: MatchView[];
};

export function RoundsTabs({
  sessionId,
  admin,
  rounds,
  labels,
}: {
  sessionId: string;
  admin: boolean;
  rounds: RoundView[];
  labels: {
    roundWord: string;
    deleteRound: string;
    bye: string;
    draw: string;
    pending: string;
    winPrefix: string;
    mine: string;
  };
}) {
  const defaultRound = rounds[rounds.length - 1]?.id;

  const nameClass = (won: boolean, decided: boolean) =>
    won
      ? "font-semibold text-primary"
      : decided
        ? "text-muted-foreground"
        : undefined;

  return (
    <Tabs defaultValue={defaultRound} className="gap-4">
      <div className="overflow-x-auto">
        <TabsList>
          {rounds.map((r) => (
            <TabsTrigger key={r.id} value={r.id}>
              {labels.roundWord} {r.number}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {rounds.map((round) => (
        <TabsContent key={round.id} value={round.id} className="flex flex-col gap-2">
          {admin && round.isLast && (
            <form action={deleteRoundAction} className="self-end">
              <input type="hidden" name="session_id" value={sessionId} />
              <input type="hidden" name="round_id" value={round.id} />
              <Button type="submit" variant="ghost" size="sm">
                {labels.deleteRound}
              </Button>
            </form>
          )}
          <ul className="flex flex-col gap-1">
            {round.matches.map((m) => {
              const decided = m.result === "p1_win" || m.result === "p2_win";
              return (
                <li
                  key={m.id}
                  className={`flex flex-col gap-2 rounded-md px-2 py-2 sm:flex-row sm:items-center sm:justify-between ${
                    m.isMine ? "bg-accent/60" : ""
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-sm">
                    {m.result === "p1_win" && (
                      <Trophy className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className={nameClass(m.result === "p1_win", decided)}>
                      {m.p1Name}
                    </span>
                    {m.p2Name ? (
                      <>
                        <span className="text-muted-foreground">vs</span>
                        {m.result === "p2_win" && (
                          <Trophy className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className={nameClass(m.result === "p2_win", decided)}>
                          {m.p2Name}
                        </span>
                      </>
                    ) : (
                      <Badge variant="secondary">{labels.bye}</Badge>
                    )}
                    {m.result === "draw" && (
                      <Badge variant="outline">{labels.draw}</Badge>
                    )}
                    {m.isMine && (
                      <Badge variant="outline" className="ml-1">
                        {labels.mine}
                      </Badge>
                    )}
                  </span>

                  {m.result === "pending" && m.p2Name && m.canReport && (
                    <div className="flex flex-wrap gap-1">
                      <form action={reportMatchAction}>
                        <input type="hidden" name="session_id" value={sessionId} />
                        <input type="hidden" name="match_id" value={m.id} />
                        <input type="hidden" name="result" value="p1_win" />
                        <Button type="submit" variant="outline" size="sm">
                          {labels.winPrefix} {m.p1Name}
                        </Button>
                      </form>
                      <form action={reportMatchAction}>
                        <input type="hidden" name="session_id" value={sessionId} />
                        <input type="hidden" name="match_id" value={m.id} />
                        <input type="hidden" name="result" value="draw" />
                        <Button type="submit" variant="outline" size="sm">
                          {labels.draw}
                        </Button>
                      </form>
                      <form action={reportMatchAction}>
                        <input type="hidden" name="session_id" value={sessionId} />
                        <input type="hidden" name="match_id" value={m.id} />
                        <input type="hidden" name="result" value="p2_win" />
                        <Button type="submit" variant="outline" size="sm">
                          {labels.winPrefix} {m.p2Name}
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
