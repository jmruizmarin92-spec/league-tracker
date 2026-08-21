"use client";

import { useActionState } from "react";
import type { RoundActionState } from "@/app/actions/rounds";
import { Button } from "@/components/ui/button";

/**
 * A one-button form around a `useActionState`-shaped server action whose
 * result has to come back to the button that asked for it. A plain
 * `<form action>` swallows the action's return value, and round actions can
 * legitimately refuse (generate: every remaining pairing is a rematch; re-pair:
 * no rematch-free fix exists) — the refusal renders inline next to the button.
 * `fields` become hidden inputs.
 */
export function ActionStateButton({
  action,
  fields,
  label,
  disabled,
  variant = "default",
  className,
}: {
  action: (prev: RoundActionState, formData: FormData) => Promise<RoundActionState>;
  fields: Record<string, string>;
  label: string;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<RoundActionState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={disabled || pending}>
        {label}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
