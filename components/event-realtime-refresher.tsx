"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Event twin of RealtimeRefresher: keeps the pairing view live so the TO
// dropping the next .tdf reaches every phone in the room without anyone
// reloading. The slow poll covers a missed realtime event (venue wifi).
export function EventRealtimeRefresher({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const filter = `event_id=eq.${eventId}`;

    const channel = supabase
      .channel(`event-pairings-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_matches", filter },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_rounds", filter },
        () => router.refresh(),
      )
      .subscribe();

    const fallback = setInterval(() => router.refresh(), 30_000);

    return () => {
      clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  return null;
}
