"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, Pause, Play, RotateCcw } from "lucide-react";
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

// Opt-in is per device, not per account: the same player may watch from a phone
// at the table and a laptop, and only wants the alert where they can act on it.
const ALERTS_KEY = "league.timer-alerts";

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Whether this device wants the time-up alert. It depends on localStorage and
// on the browser's permission state, neither of which exists on the server, so
// it is read through useSyncExternalStore rather than being pushed into state
// from an effect. Permission can also be revoked in browser settings long after
// we stored "on", so the browser is the source of truth, not our flag.
type AlertsState = "unsupported" | "blocked" | "on" | "off";

const ALERTS_EVENT = "league:timer-alerts-changed";

function subscribeAlerts(onChange: () => void) {
  // "storage" covers other tabs; the custom event covers this one, which
  // "storage" deliberately skips.
  window.addEventListener("storage", onChange);
  window.addEventListener(ALERTS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ALERTS_EVENT, onChange);
  };
}

function readAlerts(): AlertsState {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return window.localStorage.getItem(ALERTS_KEY) === "on" &&
    Notification.permission === "granted"
    ? "on"
    : "off";
}

// Server render and hydration: assume nothing is available, then let the first
// client snapshot correct it.
const alertsServerSnapshot = (): AlertsState => "unsupported";

export function RoundTimer({
  roundId,
  admin,
  timer,
  large,
  notify,
  labels,
}: {
  roundId: string;
  admin: boolean;
  timer: RoundTimerState;
  large?: boolean;
  // Present only on views where a browser notification makes sense: the session
  // page, which one person reads on their own device. The shared display screen
  // leaves it off, and with it the toggle. `title`/`body` are the notification
  // text; the rest label the toggle.
  notify?: {
    title: string;
    body: string;
    enable: string;
    disable: string;
    blocked: string;
  };
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

  // --- Time-up browser notification -----------------------------------------
  const alerts = useSyncExternalStore(
    subscribeAlerts,
    readAlerts,
    alertsServerSnapshot,
  );
  const alertsOn = alerts === "on";

  const toggleAlerts = useCallback(async () => {
    if (!alertsOn && Notification.permission === "default") {
      // First opt-in on this device: the browser prompt only opens off a user
      // gesture, which is why this lives on a button and not on mount.
      await Notification.requestPermission();
    }
    window.localStorage.setItem(ALERTS_KEY, alertsOn ? "off" : "on");
    window.dispatchEvent(new Event(ALERTS_EVENT));
  }, [alertsOn]);

  // One timeout aimed at the server's absolute end time, rather than watching
  // the 1s render tick: a backgrounded tab throttles the tick to about once a
  // minute, but a pending timeout still fires roughly on time.
  const endsAt = timer.endsAt;
  const notifyTitle = notify?.title;
  const notifyBody = notify?.body;
  useEffect(() => {
    if (!alertsOn || !endsAt || !notifyTitle) return;
    const delay = new Date(endsAt).getTime() - Date.now();
    // Already expired by the time we got here (page opened late, or a re-render
    // after the round ended): stay quiet instead of firing a stale alert.
    if (delay <= 0) return;
    const id = setTimeout(() => {
      // The tag collapses duplicates: a player who is also an admin has two
      // RoundTimers mounted for the same round, and both schedule this.
      new Notification(notifyTitle, {
        body: notifyBody,
        tag: `round-timer-${endsAt}`,
      });
    }, delay);
    return () => clearTimeout(id);
  }, [alertsOn, endsAt, notifyTitle, notifyBody]);

  if (idle && !admin) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {remaining != null && (
        <div className="flex items-center gap-1">
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
          {notify && alerts !== "unsupported" && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={toggleAlerts}
              disabled={alerts === "blocked"}
              title={
                alerts === "blocked"
                  ? notify.blocked
                  : alertsOn
                    ? notify.disable
                    : notify.enable
              }
              aria-label={alertsOn ? notify.disable : notify.enable}
              aria-pressed={alertsOn}
            >
              {alertsOn ? <Bell /> : <BellOff className="text-muted-foreground" />}
            </Button>
          )}
        </div>
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
