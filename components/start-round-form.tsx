"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { startRoundAction } from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Admin "start round" for a round whose pairings are posted but not yet
 * played: flips it to `playing` and starts the round clock with the minutes
 * typed here. Minutes pre-fill from the session's configured round length.
 * Setting minutes to 0 starts the round without a clock.
 */
export function StartRoundForm({
  roundId,
  defaultMinutes,
  labels,
}: {
  roundId: string;
  defaultMinutes: number;
  labels: { minutes: string; start: string };
}) {
  const [minutes, setMinutes] = useState(defaultMinutes);

  return (
    <form action={startRoundAction} className="flex items-center gap-2">
      <input type="hidden" name="round_id" value={roundId} />
      <input type="hidden" name="duration_seconds" value={minutes * 60} />
      <Input
        type="number"
        min={0}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        className="w-16 text-center"
        aria-label={labels.minutes}
      />
      <Button type="submit" size="sm">
        <Play className="h-4 w-4" /> {labels.start}
      </Button>
    </form>
  );
}
