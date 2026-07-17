"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { reportMatchAction, deleteRoundAction } from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MatchView = {
  id: string;
  p1Name: string;
  p2Name: string | null; // null = bye
  result: "pending" | "p1_win" | "p2_win" | "draw" | "bye" | "loss";
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
    loss: string;
    draw: string;
    pending: string;
    winPrefix: string;
    mine: string;
    vs: string;
  };
}) {
  // Always land on the latest round. Controlled state (not defaultValue) so a
  // soft re-render — realtime update or a newly generated round — snaps back to
  // the latest tab; manual selection within the same set of rounds is kept.
  const latestRound = rounds[rounds.length - 1]?.id;
  const [active, setActive] = useState(latestRound);
  useEffect(() => {
    setActive(latestRound);
  }, [latestRound]);

  const nameClass = (won: boolean, decided: boolean) =>
    won
      ? "font-semibold text-primary"
      : decided
        ? "text-muted-foreground"
        : undefined;

  return (
    <Tabs value={active} onValueChange={setActive} className="gap-4">
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
          <ul className="flex flex-col gap-2">
            {round.matches.map((m) => {
              const decided =
                m.result === "p1_win" ||
                m.result === "p2_win" ||
                m.result === "loss";
              // Two-player matches: players report only their own pending game;
              // admins can set or correct the result on any round.
              const canInput =
                !!m.p2Name && (m.result === "pending" ? m.canReport : admin);
              return (
                <li
                  key={m.id}
                  className={`rounded-md border px-2 py-2 ${
                    m.isMine ? "bg-accent/60" : ""
                  }`}
                >
                  {m.p2Name ? (
                    // Three equal columns: player 1 | VS | player 2, each cell
                    // stacking the name over its result button.
                    <div className="grid grid-cols-3 items-stretch gap-2 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex items-center gap-1 text-sm">
                          {m.result === "p1_win" && (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span className={nameClass(m.result === "p1_win", decided)}>
                            {m.p1Name}
                          </span>
                        </span>
                        {canInput && (
                          <form action={reportMatchAction} className="w-full">
                            <input type="hidden" name="session_id" value={sessionId} />
                            <input type="hidden" name="match_id" value={m.id} />
                            <input type="hidden" name="result" value="p1_win" />
                            <Button
                              type="submit"
                              variant={m.result === "p1_win" ? "default" : "outline"}
                              size="sm"
                              className="w-full"
                            >
                              {labels.winPrefix}
                            </Button>
                          </form>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        {m.result === "draw" && !canInput ? (
                          <Badge variant="outline">{labels.draw}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {labels.vs}
                          </span>
                        )}
                        {canInput && (
                          <form action={reportMatchAction} className="w-full">
                            <input type="hidden" name="session_id" value={sessionId} />
                            <input type="hidden" name="match_id" value={m.id} />
                            <input type="hidden" name="result" value="draw" />
                            <Button
                              type="submit"
                              variant={m.result === "draw" ? "default" : "outline"}
                              size="sm"
                              className="w-full"
                            >
                              {labels.draw}
                            </Button>
                          </form>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <span className="flex items-center gap-1 text-sm">
                          {m.result === "p2_win" && (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span className={nameClass(m.result === "p2_win", decided)}>
                            {m.p2Name}
                          </span>
                        </span>
                        {canInput && (
                          <form action={reportMatchAction} className="w-full">
                            <input type="hidden" name="session_id" value={sessionId} />
                            <input type="hidden" name="match_id" value={m.id} />
                            <input type="hidden" name="result" value="p2_win" />
                            <Button
                              type="submit"
                              variant={m.result === "p2_win" ? "default" : "outline"}
                              size="sm"
                              className="w-full"
                            >
                              {labels.winPrefix}
                            </Button>
                          </form>
                        )}
                      </div>

                      {m.isMine && (
                        <div className="col-span-3 flex justify-center">
                          <Badge variant="outline">{labels.mine}</Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Bye / loss: single player, no result buttons.
                    <span className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span>{m.p1Name}</span>
                      {m.result === "loss" ? (
                        <Badge variant="outline">{labels.loss}</Badge>
                      ) : (
                        <Badge variant="secondary">{labels.bye}</Badge>
                      )}
                      {m.isMine && (
                        <Badge variant="outline" className="ml-1">
                          {labels.mine}
                        </Badge>
                      )}
                    </span>
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
