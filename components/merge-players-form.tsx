"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergePlayersAction, type ActionState } from "@/app/actions/players";

type Option = { id: string; label: string };

export function MergePlayersForm({
  fromPlayers,
  intoPlayers,
  labels,
}: {
  fromPlayers: Option[];
  intoPlayers: Option[];
  labels: {
    from: string;
    into: string;
    cta: string;
    fromPlaceholder: string;
    intoPlaceholder: string;
    success: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mergePlayersAction,
    {},
  );
  const [from, setFrom] = useState("");
  const [into, setInto] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="into" value={into} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-muted-foreground">{labels.from}</label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger>
              <SelectValue placeholder={labels.fromPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {fromPlayers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-muted-foreground">{labels.into}</label>
          <Select value={into} onValueChange={setInto}>
            <SelectTrigger>
              <SelectValue placeholder={labels.intoPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {intoPlayers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || !from || !into}
        >
          {labels.cta}
        </Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state?.ok && <p className="text-sm text-primary">{labels.success}</p>}
      </div>
    </form>
  );
}
