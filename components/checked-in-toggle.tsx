"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";

export function CheckedInToggle({
  sessionId,
  playerId,
  initial,
  action,
  label,
}: {
  sessionId: string;
  playerId: string;
  initial: boolean;
  action: (
    sessionId: string,
    playerId: string,
    checkedIn: boolean,
  ) => Promise<void>;
  label: string;
}) {
  const [checked, setChecked] = useState(initial);
  const [, startTransition] = useTransition();
  const id = `checked-in-${playerId}`;

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => {
          setChecked(v);
          startTransition(() => action(sessionId, playerId, v));
        }}
      />
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
    </div>
  );
}
