"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import {
  reportMatchAction,
  deleteRoundAction,
  repairRoundAction,
} from "@/app/actions/rounds";
import type { RoundStatus } from "@/lib/rounds";
import { RoundTimer, type RoundTimerState } from "@/components/round-timer";
import { StartRoundForm } from "@/components/start-round-form";
import { ActionStateButton } from "@/components/action-state-button";
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
  table: number | null;
};

export type RoundView = {
  id: string;
  number: number;
  status: RoundStatus;
  isLast: boolean;
  matches: MatchView[];
  timer: RoundTimerState;
};

export function RoundsTabs({
  sessionId,
  admin,
  rounds,
  defaultTimerMinutes,
  needsRepair,
  labels,
}: {
  sessionId: string;
  admin: boolean;
  rounds: RoundView[];
  // Pre-fill for the "start round" clock (session round length, else 40).
  defaultTimerMinutes: number;
  // The roster changed since the latest round's pairings were posted (someone
  // seated is no longer active, or an active player has no match).
  needsRepair: boolean;
  labels: {
    roundWord: string;
    deleteRound: string;
    statusPairing: string;
    statusPlaying: string;
    startRound: string;
    repairRound: string;
    repairHint: string;
    notStarted: string;
    bye: string;
    loss: string;
    draw: string;
    pending: string;
    winPrefix: string;
    mine: string;
    vs: string;
    tableLabel: string;
    timerMinutesPlaceholder: string;
    timerStart: string;
    timerPause: string;
    timerResume: string;
    timerReset: string;
    timerPaused: string;
    timerTimeUp: string;
    timerAlertsEnable: string;
    timerAlertsDisable: string;
    timerAlertsBlocked: string;
    timerNotifyBody: string;
  };
}) {
  // Always land on the latest round. Controlled state (not defaultValue) so a
  // soft re-render — realtime update or a newly generated round — snaps back to
  // the latest tab; manual selection within the same set of rounds is kept.
  // The snap happens during render (React's "adjust state on prop change"
  // pattern) rather than in an effect, which would set state in an effect body.
  const latestRound = rounds[rounds.length - 1]?.id;
  const [active, setActive] = useState(latestRound);
  const [seenLatest, setSeenLatest] = useState(latestRound);
  if (latestRound !== seenLatest) {
    setSeenLatest(latestRound);
    setActive(latestRound);
  }

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
          {/* Latest round only: its lifecycle (pairings posted / playing) and
              the admin controls for it. Players read the clock off their own
              match card at the top of the page, so it isn't duplicated here. */}
          {round.isLast && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={round.status === "playing" ? "default" : "secondary"}
                >
                  {round.status === "pairing"
                    ? labels.statusPairing
                    : labels.statusPlaying}
                </Badge>
                {round.status === "pairing" && !admin && (
                  <span className="text-xs text-muted-foreground">
                    {labels.notStarted}
                  </span>
                )}
                {admin && round.status === "pairing" && (
                  <StartRoundForm
                    roundId={round.id}
                    defaultMinutes={defaultTimerMinutes}
                    labels={{
                      minutes: labels.timerMinutesPlaceholder,
                      start: labels.startRound,
                    }}
                  />
                )}
                {admin && round.status !== "pairing" && (
                  <RoundTimer
                    roundId={round.id}
                    admin={admin}
                    timer={round.timer}
                    notify={{
                      title: `${labels.roundWord} ${round.number}`,
                      body: labels.timerNotifyBody,
                      enable: labels.timerAlertsEnable,
                      disable: labels.timerAlertsDisable,
                      blocked: labels.timerAlertsBlocked,
                    }}
                    labels={{
                      minutesPlaceholder: labels.timerMinutesPlaceholder,
                      start: labels.timerStart,
                      pause: labels.timerPause,
                      resume: labels.timerResume,
                      reset: labels.timerReset,
                      paused: labels.timerPaused,
                      timeUp: labels.timerTimeUp,
                    }}
                  />
                )}
              </div>
              {admin && (
                <form action={deleteRoundAction}>
                  <input type="hidden" name="session_id" value={sessionId} />
                  <input type="hidden" name="round_id" value={round.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    {labels.deleteRound}
                  </Button>
                </form>
              )}
            </div>
          )}
          {/* Re-pair is only offered while pairings are posted and nothing has
              been played: it replaces the round's matches. */}
          {round.isLast && admin && round.status === "pairing" && (
            <div className="flex flex-wrap items-center gap-3">
              <ActionStateButton
                action={repairRoundAction}
                fields={{ session_id: sessionId, round_id: round.id }}
                label={labels.repairRound}
                variant={needsRepair ? "default" : "outline"}
              />
              {needsRepair && (
                <span className="text-xs text-muted-foreground">
                  {labels.repairHint}
                </span>
              )}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {round.matches.map((m) => {
              const decided =
                m.result === "p1_win" ||
                m.result === "p2_win" ||
                m.result === "loss";
              // Two-player matches: players report only their own pending game;
              // admins can set or correct the result on any round. Nothing is
              // reportable before the round starts (the RPC refuses too).
              const canInput =
                round.status !== "pairing" &&
                !!m.p2Name &&
                (m.result === "pending" ? m.canReport : admin);
              return (
                <li
                  key={m.id}
                  className={`rounded-md border px-2 py-2 ${
                    m.isMine ? "bg-accent/60" : ""
                  }`}
                >
                  {m.table != null && (
                    <div className="mb-1.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {labels.tableLabel} {m.table}
                    </div>
                  )}
                  {m.p2Name ? (
                    // Three equal columns: player 1 | VS | player 2, each cell
                    // stacking the name over its result button.
                    <div className="grid grid-cols-3 items-stretch gap-2 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex w-full min-w-0 items-center justify-center gap-1 text-sm">
                          {m.result === "p1_win" && (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span
                            className={`min-w-0 truncate ${nameClass(m.result === "p1_win", decided) ?? ""}`}
                            title={m.p1Name}
                          >
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
                        <span className="flex w-full min-w-0 items-center justify-center gap-1 text-sm">
                          {m.result === "p2_win" && (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span
                            className={`min-w-0 truncate ${nameClass(m.result === "p2_win", decided) ?? ""}`}
                            title={m.p2Name ?? undefined}
                          >
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
                      <span className="min-w-0 flex-1 truncate" title={m.p1Name}>
                        {m.p1Name}
                      </span>
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
