import type { CSSProperties, ReactNode } from "react";

const ULTRA = { "--c": "var(--ultra)", "--on": "var(--paper)" } as CSSProperties;

/** Cabeçalho de página da bilheteria: campo ultramarino, título condensado. */
export function BoxHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-head bo-head on-field" style={ULTRA}>
      <div className="wrap">
        <h1>{title}</h1>
        {children ? <div className="bo-head-text">{children}</div> : null}
      </div>
    </header>
  );
}

/** Corpo em 7:5: folha com o formulário à esquerda, notas do balcão à direita. */
export function BoxBody({ children, notes }: { children: ReactNode; notes?: ReactNode }) {
  return (
    <div className="wrap bo">
      <div className="bo-main">{children}</div>
      {notes ? <aside className="bo-aside">{notes}</aside> : null}
    </div>
  );
}

/** Notas do balcão: lista pautada de fatos sobre o que acontece. */
export function Notes({ title, items }: { title: string; items: [string, ReactNode][] }) {
  return (
    <section className="bo-notes" aria-label={title}>
      <h2>{title}</h2>
      <dl className="details">
        {items.map(([term, desc]) => (
          <div key={term} className="bo-note">
            <dt>{term}</dt>
            <dd>{desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
