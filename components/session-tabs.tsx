"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SessionTab = {
  value: string;
  label: string;
  content: ReactNode;
};

/**
 * Top-level tab strip for the session page. Every panel is rendered on the
 * server up front — the tabs only decide what is visible, they don't defer any
 * fetching. `line` variant so the round pills nested inside the rounds panel
 * still read as a separate, lower level of navigation.
 */
export function SessionTabs({
  tabs,
  initial,
}: {
  tabs: SessionTab[];
  initial: string;
}) {
  const [active, setActive] = useState(initial);

  // A server action can drop the active tab out from under us (session set to
  // complete hides the admin panels, a deleted round empties the rounds tab).
  // Derived instead of stored so there's no window where nothing is selected.
  const fallback = tabs.some((t) => t.value === initial)
    ? initial
    : (tabs[0]?.value ?? "");
  const current = tabs.some((t) => t.value === active) ? active : fallback;

  return (
    <Tabs value={current} onValueChange={setActive} className="gap-4">
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
