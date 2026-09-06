"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "done";

// Give up on a navigation that never lands (cancelled, errored) so the bar
// can't sit at 90% forever.
const STALL_MS = 15_000;
// Time for the "fill to 100% then fade" exit before the bar is reset.
const EXIT_MS = 450;

const STYLE: Record<Phase, CSSProperties> = {
  // Always mounted so "idle -> loading" is a real transition from scaleX(0).
  idle: { transform: "scaleX(0)", opacity: 0, transition: "none" },
  // Creep towards 90% and never arrive; the opacity delay keeps instant
  // navigations from flashing a bar that finished before it was visible.
  loading: {
    transform: "scaleX(0.9)",
    opacity: 1,
    transition:
      "transform 8s cubic-bezier(0.1, 0.7, 0.3, 1), opacity 150ms linear 120ms",
  },
  done: {
    transform: "scaleX(1)",
    opacity: 0,
    transition: "transform 150ms ease-out, opacity 250ms ease 150ms",
  },
};

/**
 * Thin progress bar at the top of the viewport for client-side navigations
 * (PL-27). Every page here is dynamic and there is no `loading.tsx`, so a tap
 * on a row or link otherwise shows nothing until the new page arrives.
 *
 * Start: a document-level click on an anchor that Next's `<Link>` took over
 * (it calls `preventDefault`; modified clicks, new-tab, download and external
 * links are left to the browser, which shows its own loading state) and whose
 * pathname+search differs from the current one (same-URL and hash clicks
 * never change the URL, so there would be no "done" signal).
 * Done: `usePathname` / `useSearchParams` commit a different URL.
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.defaultPrevented || e.button !== 0) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      setPhase("loading");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // URL committed: finish the bar if one was running. Back/forward changes
  // the URL too, but with the bar idle that's a no-op.
  const urlKey = `${pathname}?${searchParams.toString()}`;
  const lastUrl = useRef(urlKey);
  useEffect(() => {
    if (lastUrl.current === urlKey) return;
    lastUrl.current = urlKey;
    setPhase((p) => (p === "loading" ? "done" : p));
  }, [urlKey]);

  useEffect(() => {
    if (phase === "idle") return;
    const id = window.setTimeout(
      () => setPhase("idle"),
      phase === "done" ? EXIT_MS : STALL_MS,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  return <div aria-hidden className="nav-progress" style={STYLE[phase]} />;
}
