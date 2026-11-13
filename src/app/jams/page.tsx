import type { Metadata } from "next";
import Link from "next/link";
import { GAMES, JAMS, formatDay, jamState, pickNow, trackById } from "@/data/catalog";
import { JamSchedule } from "@/components/JamSchedule";
import { Joined, trackStyle } from "@/components/bits";
import { EmptyProgramme } from "@/components/EmptyProgramme";
import "@/styles/jams-criadores.css";

export const metadata: Metadata = { title: "Jams" };

// Os cartões seguem o mesmo relógio da agenda; a página se refaz a cada 5 minutos.
export const revalidate = 300;

export default function JamsPage() {
  const NOW = pickNow();
  return (
    <>
      <header className="page-head on-field" style={trackStyle("experimental")}>
        <div className="wrap">
          <h1>Jams</h1>
          <p>Maratonas com tema e relógio. Na maioria, as entradas entram no programa juntas quando o prazo zera; algumas publicam cada jogo assim que ele chega.</p>
        </div>
      </header>
      {JAMS.length === 0 ? (
        <section className="wrap" style={{ paddingBottom: 96 }}>
          <EmptyProgramme
            title="Nenhuma jam na agenda"
            action={null}
            secondary={{ href: "/ajuda#jams", label: "Como funcionam as jams" }}
          >
            Quando uma jam for marcada, ela aparece aqui com tema, prazo e uma linha do tempo com a marca de agora.
            Criar uma jam pelo site ainda não é possível.
          </EmptyProgramme>
        </section>
      ) : (
      <section className="wrap" style={{ paddingTop: 48, paddingBottom: 128 }}>
        <JamSchedule serverNow={NOW} />
        <div className="jam-list">
          {JAMS.filter((j) => jamState(j, NOW) !== "past")
            .sort((a, b) => +new Date(a.start) - +new Date(b.start))
            .map((j) => {
            const state = jamState(j, NOW);
            const tr = trackById(j.track);
            const entries = GAMES.filter((g) => g.jam === j.slug);
            return (
              <article
                key={j.slug}
                id={j.slug}
                className={`jam-card${tr.on === "--paper" && state !== "past" ? " on-field" : ""}`}
                data-state={state}
                style={trackStyle(j.track)}
              >
                <div className="state">
                  <span>{state === "live" ? "Rolando agora" : state === "past" ? "Encerrada" : "Em breve"}</span>
                  <span>
                    {formatDay(j.start)} → {formatDay(j.end)}
                  </span>
                </div>
                <h3>
                  <Link href={`/jams/${j.slug}`}>{j.title}</Link>
                </h3>
                <p className="theme">Tema: {j.theme}</p>
                <p>{j.summary}</p>
                {entries.length > 0 && (
                  <p>
                    Inclui{" "}
                    <Joined>
                      {entries.map((g) => (
                        <Link key={g.slug} href={`/jogo/${g.slug}`}>
                          {g.title}
                        </Link>
                      ))}
                    </Joined>
                  </p>
                )}
                <div className="foot">
                  <span>Organiza: {j.host}</span>
                  <span>{j.entries > 0 ? `${j.entries} entradas` : "inscrições abertas"}</span>
                </div>
              </article>
            );
          })}
        </div>
        {JAMS.some((j) => jamState(j, NOW) === "past") ? (
        <section className="jam-past" aria-labelledby="encerradas">
          <h2 id="encerradas">Encerradas</h2>
          <ol>
            {JAMS.filter((j) => jamState(j, NOW) === "past").map((j) => (
              <li key={j.slug} id={j.slug}>
                <strong>
                  <Link href={`/jams/${j.slug}`}>{j.title}</Link>
                </strong>
                <span>Tema: {j.theme}</span>
                <span>
                  <Joined>
                    {GAMES.filter((g) => g.jam === j.slug).map((g) => (
                      <Link key={g.slug} href={`/jogo/${g.slug}`}>
                        {g.title}
                      </Link>
                    ))}
                  </Joined>{" "}
                  e mais {j.entries - GAMES.filter((g) => g.jam === j.slug).length} entradas
                </span>
                <span>
                  {formatDay(j.start)} → {formatDay(j.end)}
                </span>
              </li>
            ))}
          </ol>
        </section>
        ) : null}
      </section>
      )}
    </>
  );
}
