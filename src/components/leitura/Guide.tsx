import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const ULTRA = { "--c": "var(--ultra)", "--on": "var(--paper)" } as CSSProperties;

export type GuidePart = "sobre" | "ajuda" | "novidades";

const PARTS: { id: GuidePart; href: string; label: string }[] = [
  { id: "sobre", href: "/sobre", label: "Como funciona" },
  { id: "ajuda", href: "/ajuda", label: "Ajuda" },
  { id: "novidades", href: "/novidades", label: "Novidades" },
];

/**
 * Running head of the guide: the three reading parts of the programme,
 * with the one the reader is in marked like the masthead's current page.
 */
export function GuideStrip({ current, exact = true }: { current: GuidePart; exact?: boolean }) {
  return (
    <nav className="guide-strip" aria-label="Guia do programa">
      <div className="wrap">
        <span className="guide-strip-name" aria-hidden>
          Guia do programa
        </span>
        <ul>
          {PARTS.map((p) => (
            <li key={p.id}>
              <Link href={p.href} aria-current={p.id === current ? (exact ? "page" : "true") : undefined}>
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Page head on the ultramarine field, followed by the guide's running head. */
export function GuideHead({ title, current, children }: { title: string; current: GuidePart; children?: ReactNode }) {
  return (
    <>
      <header className="page-head guide-head on-field" style={ULTRA}>
        <div className="wrap">
          <h1>{title}</h1>
          {children ? <div className="guide-head-text">{children}</div> : null}
        </div>
      </header>
      <GuideStrip current={current} />
    </>
  );
}

/** A section of a guide page: title over the 6px double rule. */
export function GuideSection({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="guide-sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {intro ? <p className="guide-intro">{intro}</p> : null}
      {children}
    </section>
  );
}
