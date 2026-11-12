"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TRACKS, type TrackId } from "@/data/catalog";

/**
 * Programme thumb-index: one coloured tab per track. Vertical on the page edge
 * at desktop widths, a horizontal tab strip under the masthead below that.
 * The tab for the track in view (home) or in the filter (catalogue) is pulled out.
 */
export function ThumbIndex() {
  const params = useSearchParams();
  const path = usePathname();
  const mode = path === "/" ? "home" : "catalog";
  const [inView, setInView] = useState<TrackId | null>(null);

  useEffect(() => {
    if (mode !== "home") return;
    const els = TRACKS.map((t) => document.getElementById(`trilha-${t.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setInView(e.target.id.replace("trilha-", "") as TrackId);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => {
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      const y = window.innerHeight / 2;
      if (first.getBoundingClientRect().top > y || last.getBoundingClientRect().bottom < y) setInView(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [mode]);

  const active = mode === "home" ? inView : path.startsWith("/jogos") ? (params.get("trilha") as TrackId | null) : null;

  return (
    <nav className="thumb-index" aria-label="Trilhas do programa">
      {TRACKS.map((t) => (
        <Link
          key={t.id}
          href={mode === "home" ? `/#trilha-${t.id}` : `/jogos?trilha=${t.id}`}
          aria-current={active === t.id ? "true" : undefined}
          style={{ "--c": `var(${t.color})`, "--on": `var(${t.on})` } as React.CSSProperties}
        >
          {t.name}
        </Link>
      ))}
    </nav>
  );
}
