import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog/server";
import { EmptyProgramme } from "@/components/EmptyProgramme";
import { Catalog } from "./Catalog";

export const metadata: Metadata = { title: "Catálogo" };

export const revalidate = 60;

export default async function CatalogPage() {
  const { games } = await getCatalog();
  if (games.length === 0) {
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
            jogos já pode montar a página, enviar os arquivos e publicar.
          </EmptyProgramme>
        </section>
      </>
    );
  }
  return (
    <>
      <Suspense>
        <Catalog games={games} />
      </Suspense>
    </>
  );
}
