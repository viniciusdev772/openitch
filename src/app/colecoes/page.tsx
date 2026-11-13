import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import "@/styles/colecoes.css";
import { creatorBySlug } from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { trackStyle } from "@/components/bits";
import { COLECOES, colecaoCurator, colecaoEntries } from "@/data/colecoes";
import { ColecaoRow, GameCount, MiniCovers, fieldClass } from "@/components/colecoes/parts";

export const metadata: Metadata = {
  title: "Coleções",
  description:
    "Blocos temáticos do programa: jogos escolhidos por quem publica no openitch, cada um com a nota de por que está ali.",
};

export default function ColecoesPage() {
  const [lead, ...rest] = COLECOES;
  const billed = rest.slice(0, 2);
  const rows = rest.slice(2);
  const leadEntries = colecaoEntries(lead);
  const leadCurator = colecaoCurator(lead);

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <h1>Coleções</h1>
          <p>
            Blocos do programa montados por quem publica aqui e pela equipe, como os blocos temáticos de um festival. Cada
            jogo vem com uma nota curta dizendo por que está no bloco. Seleções e notas são material de demonstração.
          </p>
        </div>
      </header>

      {/* Lead block: billed as a whole track field */}
      <section
        className={`col-lead ${fieldClass(lead)}`}
        style={trackStyle(lead.track)}
        aria-labelledby={`bloco-${lead.slug}`}
      >
        <div className="wrap">
          <div className="col-lead-intro">
            <h2 id={`bloco-${lead.slug}`}>
              <Link href={`/colecoes/${lead.slug}`}>{lead.title}</Link>
            </h2>
            <p>{lead.intro}</p>
            <p className="col-lead-by">
              Curadoria: {leadCurator.name} · <GameCount n={leadEntries.length} />
            </p>
            <Link className="btn btn--ghost" href={`/colecoes/${lead.slug}`}>
              Abrir a coleção <ArrowRight aria-hidden />
            </Link>
          </div>

          <ol className="col-lead-games" aria-label={`Primeiros jogos de ${lead.title}`}>
            {leadEntries.slice(0, 5).map(({ game }, i) => (
              <li key={game.slug}>
                <Link href={`/jogo/${game.slug}`} className="entry col-lead-game">
                  <span className="entry-art">
                    <Cover game={game} label="" />
                    {i === 0 && game.platforms.includes("web") && (
                      <span className="play-flag">
                        <Play aria-hidden fill="currentColor" /> Joga aqui
                      </span>
                    )}
                  </span>
                  <span className="col-lead-caption">
                    <span className="num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="col-lead-title">{game.title}</span>
                    {i === 0 && <span className="col-lead-maker">{creatorBySlug(game.creator)?.name}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="wrap col-index">
        {/* Second billing: two blocks as field cards */}
        <div className="col-pair">
          {billed.map((c) => {
            const entries = colecaoEntries(c);
            return (
              <Link
                key={c.slug}
                href={`/colecoes/${c.slug}`}
                className={`col-card ${fieldClass(c)}`}
                style={trackStyle(c.track)}
              >
                <h2>{c.title}</h2>
                <p className="col-card-intro">{c.intro}</p>
                <p className="col-card-line">
                  <span>Curadoria: {colecaoCurator(c).name}</span>
                  <span>
                    <GameCount n={entries.length} />
                  </span>
                </p>
                <div className="col-card-foot">
                  <MiniCovers games={entries.slice(0, 3).map((e) => e.game)} />
                  <span className="col-card-go">
                    Abrir <ArrowRight aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Third billing: the rest as a ruled programme list */}
        <section className="col-more" aria-labelledby="mais-colecoes">
          <h2 id="mais-colecoes" className="col-h2">
            Mais coleções
          </h2>
          <ol className="col-rows">
            {rows.map((c) => (
              <ColecaoRow key={c.slug} c={c} />
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
