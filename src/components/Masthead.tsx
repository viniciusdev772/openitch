"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { AuthLink } from "./AuthLink";

const NAV = [
  { href: "/", label: "Programa" },
  { href: "/jogos", label: "Catálogo" },
  { href: "/jams", label: "Jams" },
];

export function Masthead() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <div className="sample-strip">
        <div className="wrap">
          <strong>Edição de demonstração</strong>
          <span>Jogos, criadores e números deste programa são fictícios.</span>
        </div>
      </div>
      <header className="masthead">
        <div className="wrap">
          <Link href="/" className="wordmark" aria-label="openitch, página inicial">
            <b>openitch</b>
            <span>programa permanente de jogos independentes</span>
          </Link>
          <nav className="mainnav" aria-label="Principal">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={n.href === "/" ? "hide-sm" : undefined}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/jogos#busca" aria-label="Buscar jogos" className="hide-sm">
              <Search aria-hidden size={18} />
            </Link>
            <AuthLink />
            <Link href="/publicar" className="btn btn--sm" aria-current={isActive("/publicar") ? "page" : undefined}>
              Publicar
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
