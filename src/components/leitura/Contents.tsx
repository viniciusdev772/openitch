"use client";

import { useEffect, useState } from "react";

export interface ContentsItem {
  id: string;
  label: string;
  /** Printed beside the label, e.g. the number of questions in a subject. */
  count?: number;
}

/**
 * Margin contents of a guide page. Links are plain anchors; once the page is
 * scrolled, the section in view is marked so the reader knows where they are.
 */
export function Contents({ title, items, countLabel }: { title: string; items: ContentsItem[]; countLabel?: string }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 140) current = item.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav className="guide-toc" aria-labelledby="guide-toc-title">
      <h2 id="guide-toc-title">{title}</h2>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined}>
              <span>{item.label}</span>
              {item.count !== undefined ? (
                <>
                  <span className="num" aria-hidden>
                    {String(item.count).padStart(2, "0")}
                  </span>
                  <span className="visually-hidden">
                    , {item.count} {countLabel}
                  </span>
                </>
              ) : null}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
