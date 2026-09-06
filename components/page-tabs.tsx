"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PageTab = {
  value: string;
  label: string;
  content: ReactNode;
};

/**
 * Top-level tab strip for the session and event pages and the landing page's
 * "Esta semana" block. Every panel is rendered on the server up front — the
 * tabs only decide what is visible, they don't defer any fetching. `line`
 * variant so the round pills nested inside the rounds/pairings panel still
 * read as a separate, lower level of navigation.
 *
 * The active tab lives in the URL (`?tab=<value>`) rather than in state, so a
 * server action can land the visitor on a specific tab by redirecting to it
 * (the TOM import ends on Emparejamientos, PL-26) and a tab is linkable.
 * Clicks write the URL with `replaceState`, which Next folds into
 * `useSearchParams` without a server round trip. Every page using the strip
 * renders dynamically, so the hook needs no Suspense boundary.
 */
export function PageTabs({
  tabs,
  initial,
}: {
  tabs: PageTab[];
  initial: string;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");

  // `initial` is the page's opinion of where to land; the URL wins when it
  // names a tab that exists. Either can point at a tab a server action has
  // just removed (session set to complete hides the admin panels, a deleted
  // round empties the rounds tab), so both fall through to the first tab.
  const exists = (v: string | null): v is string =>
    !!v && tabs.some((t) => t.value === v);
  const current = exists(requested)
    ? requested
    : exists(initial)
      ? initial
      : (tabs[0]?.value ?? "");

  const select = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  return (
    <Tabs value={current} onValueChange={select} className="gap-4">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList variant="line">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
