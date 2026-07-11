"use client";

import type { ReactNode, ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

// Wraps a server action form so the delete only submits after the user
// confirms — these actions cascade (delete a league and its sessions/
// rounds/matches go with it) and cannot be undone.
export function ConfirmDeleteButton({
  confirmMessage,
  children,
  variant = "destructive",
  size = "sm",
}: {
  confirmMessage: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
