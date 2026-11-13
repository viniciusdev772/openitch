"use client";

import { useEffect, useState } from "react";
import { pickNow } from "./clock";

/**
 * Client-only clock for jam pages. Returns null until mounted, so the server
 * render never prints a running count. Ticks every second, or every minute
 * when the visitor asks for reduced motion.
 */
export function useJamNow() {
  const [now, setNow] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let iv: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (iv) clearInterval(iv);
      setReduced(mq.matches);
      setNow(pickNow());
      iv = setInterval(() => setNow(pickNow()), mq.matches ? 60000 : 1000);
    };
    start();
    mq.addEventListener("change", start);
    return () => {
      if (iv) clearInterval(iv);
      mq.removeEventListener("change", start);
    };
  }, []);

  return { now, reduced };
}
