"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";

/** "Entrar" ou o nome de quem está dentro. Lê /api/sessao a cada navegação. */
export function AuthLink() {
  const path = usePathname();
  const [name, setName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/sessao", { cache: "no-store", credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : { name: null }))
        .then((d: { name: string | null }) => alive && setName(d.name))
        .catch(() => alive && setName(null));
    load();
    window.addEventListener("openitch:sessao", load);
    return () => {
      alive = false;
      window.removeEventListener("openitch:sessao", load);
    };
  }, [path]);

  const inAuth = path.startsWith("/entrar") || path.startsWith("/criar-conta") || path.startsWith("/recuperar");
  if (name) {
    return (
      <Link href="/conta" className="auth-link" aria-current={path.startsWith("/conta") ? "page" : undefined}>
        <UserRound aria-hidden size={18} />
        <span>{name}</span>
      </Link>
    );
  }
  return (
    <Link
      href="/entrar"
      className="auth-link"
      aria-current={inAuth ? "page" : undefined}
      data-pending={name === undefined || undefined}
    >
      Entrar
    </Link>
  );
}
