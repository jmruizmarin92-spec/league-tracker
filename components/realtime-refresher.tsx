"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Mounted on live views: re-fetches the server-rendered page whenever the
// watched tables change for this session. A slow poll is kept as a fallback
// in case a realtime event is missed (e.g. brief network drop).
export function RealtimeRefresher({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const filter = `session_id=eq.${sessionId}`;

    const channel = supabase
      .channel(`session-display-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_participants", filter },
        () => router.refresh(),
      )
      .subscribe();

    const fallback = setInterval(() => router.refresh(), 30_000);

    return () => {
      clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [sessionId, router]);

  return null;
}
