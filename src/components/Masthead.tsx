"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { AuthLink } from "./AuthLink";

const NAV = [
  { href: "/", label: "Programa" },
  { href: "/jogos", label: "Catálogo" },
  { href: "/jams", label: "Jams" },
  { href: "/criadores", label: "Criadores" },
  { href: "/novidades", label: "Novidades" },
];

const GUIDE = [
  { href: "/jogos#busca", label: "Buscar jogos" },
  { href: "/etiquetas", label: "Etiquetas" },
  { href: "/colecoes", label: "Coleções" },
  { href: "/estante", label: "Sua estante" },
  { href: "/conta/projetos", label: "Seus rascunhos" },
  { href: "/sobre", label: "Como funciona" },
  { href: "/ajuda", label: "Ajuda" },
];

export function Masthead() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // Fecha ao navegar.
  useEffect(() => setOpen(false), [path]);

  // Esc fecha e devolve o foco ao botão.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="masthead" data-open={open || undefined}>
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
                className="nav-wide"
              >
                {n.label}
              </Link>
            ))}
            <Link href="/jogos#busca" aria-label="Buscar jogos" className="nav-wide">
              <Search aria-hidden size={18} />
            </Link>
            <AuthLink />
            <Link href="/publicar" className="btn btn--sm" aria-current={isActive("/publicar") ? "page" : undefined}>
              Publicar
            </Link>
            <button
              ref={toggle}
              type="button"
              className="nav-toggle"
              aria-expanded={open}
              aria-controls="menu-programa"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
              <span className="visually-hidden">{open ? "Fechar menu" : "Abrir menu"}</span>
            </button>
          </nav>
        </div>
        {/* Um toque em qualquer link fecha o painel, mesmo sem mudar de rota (âncoras, página atual). */}
        <div id="menu-programa" className="nav-panel" hidden={!open} onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          <div className="wrap">
            <ul className="nav-panel-main">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="nav-panel-guide">
              {GUIDE.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} aria-current={isActive(n.href) && n.href !== "/jogos#busca" ? "page" : undefined}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>
    </>
  );
}
