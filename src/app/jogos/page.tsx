import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES } from "@/data/catalog";
import { EmptyProgramme } from "@/components/EmptyProgramme";
import { Catalog } from "./Catalog";

export const metadata: Metadata = { title: "Catálogo" };

export default function CatalogPage() {
  if (GAMES.length === 0) {
    return (
      <>
        <header className="page-head">
          <div className="wrap">
            <h1>Catálogo</h1>
            <p>Todas as entradas do programa, com busca e filtros por trilha, plataforma e preço.</p>
          </div>
        </header>
        <section className="wrap">
          <EmptyProgramme title="O catálogo ainda está vazio" secondary={{ href: "/sobre", label: "Como funciona" }}>
            Nenhum jogo foi publicado ainda. Quando os primeiros entrarem, a busca e os filtros aparecem aqui. Quem faz
            jogos já pode montar a página do jogo e salvar como rascunho.
          </EmptyProgramme>
        </section>
      </>
    );
  }
  return (
    <>
      <Suspense>
        <Catalog />
      </Suspense>
    </>
  );
}
