"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Admin helper: copy every participant's Pokémon ID (one per line) to the
// clipboard for pasting into tournament software. Players without an ID are
// omitted, so the count can be lower than the roster size.
export function CopyPokemonIds({
  ids,
  labels,
}: {
  ids: string[];
  labels: { copy: string; copied: string; empty: string };
}) {
  const [copied, setCopied] = useState(false);

  if (ids.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ids.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context): fall back to no-op; the
      // list below is still visible for manual selection.
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </Button>
        <span className="text-sm text-muted-foreground">{ids.length}</span>
      </div>
      <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-sm">
        {ids.join("\n")}
      </pre>
    </div>
  );
}
