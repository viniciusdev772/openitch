import "@/styles/leitura.css";
import type { Metadata } from "next";
import { DEVLOG_KINDS, liveDevlogs, type DevlogKind } from "@/data/devlogs";
import { getCatalog } from "@/lib/catalog/server";
import { GuideHead } from "@/components/leitura/Guide";
import { Diary } from "@/components/leitura/Diary";
import { EmptyProgramme } from "@/components/EmptyProgramme";

export const metadata: Metadata = {
  title: "Novidades",
  description:
    "Diário do programa: lançamentos, atualizações, diários de desenvolvimento e notas de jam dos jogos da VibeGames.",
};

export const revalidate = 60;

export default async function NovidadesPage() {
  const cat = await getCatalog();
  const notes = liveDevlogs(cat);
  if (notes.length === 0) {
    return (
      <>
        <GuideHead title="Diário do programa" current="novidades">
          <p>Lançamentos, atualizações e diários escritos por quem faz os jogos, do mais novo para o mais antigo.</p>
        </GuideHead>
        <section className="wrap">
          <EmptyProgramme title="Nenhuma nota ainda">
            Quando um jogo for lançado ou atualizado, a nota de quem fez aparece aqui, com data e hora.
          </EmptyProgramme>
        </section>
      </>
    );
  }
  const kinds = (Object.keys(DEVLOG_KINDS) as DevlogKind[]).map((k) => ({
    kind: k,
    count: notes.filter((d) => d.kind === k).length,
  }));
  return (
    <>
      <GuideHead title="Diário do programa" current="novidades">
        <p>
          Lançamentos, atualizações e diários escritos por quem faz os jogos, do mais novo para o mais antigo.
        </p>
      </GuideHead>

      <section className="wrap diary-page" aria-labelledby="diario-lista">
        <div className="results-bar diary-bar">
          <h2 id="diario-lista">
            <span className="num">{notes.length}</span> notas
          </h2>
          <ul className="diary-kinds" aria-label="Notas por tipo">
            {kinds.map((k) => (
              <li key={k.kind}>
                {DEVLOG_KINDS[k.kind]} <span className="num">{k.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <Diary cat={cat} notes={notes} />
      </section>
    </>
  );
}
