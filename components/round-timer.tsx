"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  startRoundTimerAction,
  pauseRoundTimerAction,
  resumeRoundTimerAction,
  clearRoundTimerAction,
} from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type RoundTimerState = {
  durationSeconds: number | null;
  endsAt: string | null;
  remainingSeconds: number | null;
};

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function RoundTimer({
  roundId,
  admin,
  timer,
  large,
  labels,
}: {
  roundId: string;
  admin: boolean;
  timer: RoundTimerState;
  large?: boolean;
  labels: {
    minutesPlaceholder: string;
    start: string;
    pause: string;
    resume: string;
    reset: string;
    paused: string;
    timeUp: string;
  };
}) {
  const running = timer.endsAt != null;
  const paused = !running && timer.remainingSeconds != null;
  const idle = !running && !paused;

  // Countdown is derived from the server's absolute end time, so it stays
  // correct across tab backgrounding; the interval just forces a re-render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, timer.endsAt]);

  const [minutes, setMinutes] = useState(
    timer.durationSeconds ? Math.round(timer.durationSeconds / 60) : 40,
  );

  const remaining = running
    ? Math.max(0, Math.round((new Date(timer.endsAt as string).getTime() - now) / 1000))
    : paused
      ? (timer.remainingSeconds as number)
      : null;
  const timeUp = running && remaining === 0;

  if (idle && !admin) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {remaining != null && (
        <span
          className={`font-bold tabular-nums ${large ? "text-6xl" : "text-2xl"} ${
            timeUp
              ? "animate-pulse text-destructive"
              : paused
                ? "text-muted-foreground"
                : ""
          }`}
        >
          {timeUp ? labels.timeUp : formatClock(remaining)}
        </span>
      )}
      {paused && <Badge variant="secondary">{labels.paused}</Badge>}

      {admin && (
        <div className="flex items-center gap-2">
          {idle && (
            <>
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-16 text-center"
                aria-label={labels.minutesPlaceholder}
              />
              <form action={startRoundTimerAction}>
                <input type="hidden" name="round_id" value={roundId} />
                <input
                  type="hidden"
                  name="duration_seconds"
                  value={minutes * 60}
                />
                <Button type="submit" size="sm" disabled={!minutes || minutes <= 0}>
                  <Play className="h-4 w-4" /> {labels.start}
                </Button>
              </form>
            </>
          )}
          {running && (
            <form action={pauseRoundTimerAction}>
              <input type="hidden" name="round_id" value={roundId} />
              <Button type="submit" size="sm" variant="outline">
                <Pause className="h-4 w-4" /> {labels.pause}
              </Button>
            </form>
          )}
          {paused && (
            <form action={resumeRoundTimerAction}>
              <input type="hidden" name="round_id" value={roundId} />
              <Button type="submit" size="sm">
                <Play className="h-4 w-4" /> {labels.resume}
              </Button>
            </form>
          )}
          {(running || paused) && (
            <form action={clearRoundTimerAction}>
              <input type="hidden" name="round_id" value={roundId} />
              <Button type="submit" size="sm" variant="ghost">
                <RotateCcw className="h-4 w-4" /> {labels.reset}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
