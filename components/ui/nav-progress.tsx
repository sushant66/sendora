"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { VStack } from "@astryxdesign/core/VStack";

/**
 * A thin accent bar pinned to the top of the viewport that appears the instant a
 * navigation starts and completes when the destination route commits.
 *
 * App Router navigations to server-rendered routes (auth check + data fetching)
 * can take a beat with no built-in signal that the click even registered, which
 * reads as an unresponsive click. This gives every navigation immediate, honest
 * feedback. Astryx has no top-of-page navigation indicator, so this is a small
 * shared gap-filler; its styling lives in globals.css so it stays token-based and
 * respects prefers-reduced-motion. Purely a sighted-user affordance (the route
 * change and page title carry the change for assistive tech), so it is aria-hidden.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);

  function clearTimers() {
    if (trickle.current) clearInterval(trickle.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (safety.current) clearTimeout(safety.current);
    trickle.current = null;
    finishTimer.current = null;
    safety.current = null;
  }

  function start() {
    clearTimers();
    active.current = true;
    setVisible(true);
    setProgress(8);
    // Ease toward 90% and hold; the remaining 10% lands when the route commits.
    trickle.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.6, (90 - p) * 0.1)));
    }, 180);
    // If the route never changes (aborted nav, same page), don't hang forever.
    safety.current = setTimeout(finish, 8000);
  }

  function finish() {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress(100);
    // Let the fill reach 100%, then fade the whole bar out and reset.
    finishTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);
  }

  // Start on any same-origin, same-tab link click that changes the path. next/link
  // renders a real <a>, so one delegated listener covers every link in the app
  // (sidebar, buttons, marketing) with no per-link wiring.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || (target && target !== "_self") || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Skip cross-origin and same-page (hash / query only) clicks: no route swap to signal.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      start();
    }
    // Capture phase: next/link calls preventDefault in its own (bubble-phase) handler to run
    // a soft navigation, so a bubble-phase listener would see defaultPrevented and miss every
    // link. Capturing runs before React's handler, while the click is still pristine.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
    // start/finish/clearTimers only touch refs and stable setState functions;
    // the listener is intentionally attached once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The committed path changed: the destination is rendering, so finish the bar.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <VStack className="nav-progress-track" aria-hidden>
      <VStack
        className="nav-progress-fill"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </VStack>
  );
}
