import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import "@/styles/etiquetas.css";
import { getCatalog } from "@/lib/catalog/server";
import { trackStyle } from "@/components/bits";
import { ALPHABET, billing, tagIndex, tagsByLetter } from "@/components/etiquetas/tags";
import { EmptyProgramme } from "@/components/EmptyProgramme";

export const metadata: Metadata = {
  title: "Etiquetas",
  description: "Índice de todas as etiquetas do catálogo, por letra, com quantos jogos levam cada uma.",
};

export const revalidate = 60;

export default async function TagIndexPage() {
  const { games } = await getCatalog();
  if (tagIndex(games).length === 0) {
    return (
      <>
        <header className="page-head">
          <div className="wrap">
            <h1>Etiquetas</h1>
            <p>As palavras que quem publica dá aos próprios jogos, em ordem alfabética, como o índice no fim do programa.</p>
          </div>
        </header>
        <section className="wrap">
          <EmptyProgramme title="Nenhuma etiqueta ainda" action={{ href: "/publicar", label: "Começar um rascunho" }}>
            Cada jogo publicado traz as próprias etiquetas, como “um botão” ou “cartas”. O índice se monta sozinho a
            partir delas, com quantos jogos levam cada uma.
          </EmptyProgramme>
        </section>
      </>
    );
  }
  const groups = tagsByLetter(games);
  const present = new Set(groups.map((g) => g.letter));
  const total = tagIndex(games).length;
  const letters = present.has("#") ? [...ALPHABET, "#"] : ALPHABET;

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <h1>Etiquetas</h1>
          <p>
            As palavras que quem publica dá aos próprios jogos, em ordem alfabética, como o índice no fim do programa. O
            número ao lado é quantos jogos levam a etiqueta; quanto mais jogos, maior ela aparece.
          </p>
        </div>
      </header>

      <section className="wrap tag-index-wrap" aria-labelledby="indice-etiquetas">
        <h2 id="indice-etiquetas" className="visually-hidden">
          Índice de etiquetas
        </h2>
        <div className="results-bar">
          <p>
            <span className="num">{total}</span> etiquetas em <span className="num">{games.length}</span> jogos
          </p>
          <nav className="tag-letters" aria-label="Ir para a letra">
            {letters.map((l) =>
              present.has(l) ? (
                <a key={l} className="code" href={`#letra-${l === "#" ? "outros" : l.toLowerCase()}`}>
                  {l}
                </a>
              ) : (
                <span key={l} className="code" data-on="false" aria-hidden>
                  {l}
                </span>
              ),
            )}
          </nav>
        </div>

        <div className="tag-index">
          {groups.map(({ letter, tags }) => {
            const id = `letra-${letter === "#" ? "outros" : letter.toLowerCase()}`;
            return (
              <section key={letter} className="tag-letter" aria-labelledby={id}>
                <h3 id={id}>
                  <span aria-hidden>{letter}</span>
                  <span className="visually-hidden">{letter === "#" ? "Outros sinais" : `Letra ${letter}`}</span>
                </h3>
                <ol className="tag-lines">
                  {tags.map((t) => (
                    <li key={t.slug} data-bill={billing(t.count)} style={trackStyle(t.main)}>
                      <Link href={`/etiqueta/${t.slug}`}>
                        <span className="tag-name">{t.tag}</span>
                        <span className="tag-count">
                          <span className="num">{t.count}</span> <span className="unit">{t.count === 1 ? "jogo" : "jogos"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>

        <div className="tag-close">
          <p>Procurando outra palavra? A busca do catálogo olha título, criador, cidade e etiquetas, sem ligar para acento.</p>
          <Link className="btn btn--ghost" href="/jogos#busca">
            <Search aria-hidden /> Buscar no catálogo
          </Link>
        </div>
      </section>
    </>
  );
}
