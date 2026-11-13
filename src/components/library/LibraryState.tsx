"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LibraryKind } from "./copy";

/**
 * Ilha de estado da estante nas páginas estáticas (jogo e criador). O HTML
 * chega igual para todo mundo; depois de hidratar, uma única ida a
 * /api/estante/estado responde pelos botões da página (Guardar e Seguir).
 */

export type LibraryStatus = "loading" | "out" | "down" | boolean;

interface Result {
  status: "out" | "down" | "ready";
  saved?: boolean;
  following?: boolean;
}

interface Value {
  status: "loading" | Result["status"];
  saved?: boolean;
  following?: boolean;
  game?: string;
  creator?: string;
}

const Ctx = createContext<Value>({ status: "loading" });

// Um pedido por combinação enquanto estiver em voo: o StrictMode monta duas vezes em dev.
const inflight = new Map<string, Promise<Result>>();

function load(query: string): Promise<Result> {
  const running = inflight.get(query);
  if (running) return running;
  const p = fetch(`/api/estante/estado?${query}`, { cache: "no-store", credentials: "same-origin" })
    .then(async (r): Promise<Result> => {
      if (r.status === 401) return { status: "out" };
      if (!r.ok) return { status: "down" };
      const d = (await r.json()) as {
        jogo: { guardado: boolean } | null;
        criador: { seguindo: boolean } | null;
      };
      return { status: "ready", saved: d.jogo?.guardado === true, following: d.criador?.seguindo === true };
    })
    .catch((): Result => ({ status: "down" }))
    .finally(() => inflight.delete(query));
  inflight.set(query, p);
  return p;
}

export function LibraryState({ game, creator, children }: { game?: string; creator?: string; children: ReactNode }) {
  const [value, setValue] = useState<Value>({ status: "loading" });

  useEffect(() => {
    const q = new URLSearchParams();
    if (game) q.set("jogo", game);
    if (creator) q.set("criador", creator);
    const query = q.toString();
    if (!query) return;
    let alive = true;
    const run = () =>
      load(query).then((r) => {
        if (alive) setValue({ ...r, game, creator });
      });
    run();
    // Entrou ou saiu em outra parte do site sem recarregar: lê de novo.
    window.addEventListener("openitch:sessao", run);
    return () => {
      alive = false;
      window.removeEventListener("openitch:sessao", run);
    };
  }, [game, creator]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Estado de um botão: carregando, visitante, fora do ar, ou ligado/desligado. */
export function useLibraryStatus(kind: LibraryKind, slug: string): LibraryStatus {
  const v = useContext(Ctx);
  if (v.status === "loading" || v.status === "out" || v.status === "down") return v.status;
  if (kind === "save") return v.game === slug ? Boolean(v.saved) : "loading";
  return v.creator === slug ? Boolean(v.following) : "loading";
}
