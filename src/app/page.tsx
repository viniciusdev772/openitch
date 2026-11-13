import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { JAMS, TRACKS, dayKey, entryNumber, formatDay, formatTime, pickNow, shortPrice } from "@/data/catalog";
import { getCatalog } from "@/lib/catalog/server";
import { Cover } from "@/components/Cover";
import { PriceDemo } from "@/components/PriceDemo";
import { JamSchedule } from "@/components/JamSchedule";
import { EditDemo } from "@/components/EditDemo";
import { EmptyProgramme } from "@/components/EmptyProgramme";
import { Entry, PlatformCodes, TrackChip, trackStyle } from "@/components/bits";

export default async function Home() {
  const catalog = await getCatalog();
  const lineup = catalog.games.slice(0, 7);
  const featured = catalog.games.find((g) => g.play);
  // Same clock as the jams.
  const now = pickNow();
  const today = dayKey(now);

  return (
    <>

      {/* Programme cover */}
      <section className="cover on-field" aria-labelledby="capa-titulo">
        <div className="wrap">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1 id="capa-titulo" className="cover-title">
              vibe<em>games</em>
            </h1>
            <p className="cover-hook">
              Um festival de jogos independentes que não fecha. Publique o seu hoje: por enquanto, só jogos grátis entram.
            </p>
            <form className="cover-search" action="/jogos" role="search">
              <label htmlFor="busca-capa" className="visually-hidden">
                Buscar jogos
              </label>
              <input
                id="busca-capa"
                name="q"
                className="input"
                placeholder="Jogo, criador ou etiqueta"
                autoComplete="off"
              />
              <button className="btn btn--lime" type="submit">
                Buscar
              </button>
            </form>
            <div className="cover-actions">
              <Link href="/publicar" className="btn btn--ghost">
                Publicar meu jogo <ArrowRight aria-hidden />
              </Link>
              <Link href="/jogos">Ver o catálogo inteiro</Link>
            </div>
          </div>

          {featured ? (
            /* Em cartaz: o jogo de navegador publicado mais recente. */
            <div className="screening" aria-labelledby="sala-titulo">
              <div className="screening-head">
                <span className="live-dot">Em cartaz</span>
                <span className="num">{entryNumber(featured.number)}</span>
              </div>
              <Link
                href={featured.play!}
                className="screening-stage screening-art"
                style={{ "--g": `var(${featured.palette[0]})` } as React.CSSProperties}
                tabIndex={-1}
                aria-hidden
              >
                <Cover game={featured} label="" fit="meet" />
              </Link>
              <div className="screening-foot">
                <div>
                  <h2 id="sala-titulo">
                    <Link href={`/jogo/${featured.slug}`}>{featured.title}</Link>
                  </h2>
                  <p>
                    {catalog.creatorName(featured)} · {shortPrice(featured.price)}
                  </p>
                </div>
                <Link href={featured.play!} className="btn btn--lime btn--sm">
                  <Play aria-hidden /> Jogar agora
                </Link>
              </div>
            </div>
          ) : (
          /* A sala de exibição espera o primeiro jogo: moldura tracejada, nada aceso. */
          <div className="screening screening--empty" aria-labelledby="sala-titulo">
            <div className="screening-head">
              <span>Sala de exibição</span>
              <span className="num">Nº 0001</span>
            </div>
            <div className="screening-stage">
              <div className="screening-wait">
                <p>A sala está pronta. O primeiro jogo de navegador do programa vai rodar aqui.</p>
              </div>
            </div>
            <div className="screening-foot">
              <div>
                <h2 id="sala-titulo">Lugar vago</h2>
                <p>{catalog.games.length ? "Nenhum jogo de navegador publicado ainda." : "A entrada Nº 0001 ainda não tem dono."}</p>
              </div>
              <Link href="/publicar" className="btn btn--lime btn--sm">
                Começar um rascunho
              </Link>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* Today's lineup: screening schedule */}
      <section className="section" aria-labelledby="hoje">
        <div className="wrap">
          <div className="section-head">
            <h2 id="hoje">Hoje no programa</h2>
            <div className="aside">
              <p>
                Tudo que entrou no programa, na ordem em que chegou, com o mais novo no topo.
              </p>
              <Link href="/jogos" className="btn btn--ghost btn--sm">
                Catálogo completo
              </Link>
            </div>
          </div>
          {lineup.length === 0 ? (
            <EmptyProgramme title="O programa ainda não tem jogos">
              Os primeiros jogos vão aparecer aqui na ordem em que chegarem, com hora, trilha, plataformas e preço.
              Quem publica já pode montar a página, enviar os arquivos e publicar.
            </EmptyProgramme>
          ) : (
          <ol className="lineup">
            {lineup.map((g) => {
              const isToday = dayKey(g.published) === today;
              return (
                <li key={g.slug}>
                  <Link href={`/jogo/${g.slug}`} style={trackStyle(g.track)}>
                    <span className="lineup-time">
                      {formatTime(g.published)}
                      <small>{isToday ? "hoje" : formatDay(g.published)}</small>
                    </span>
                    <span className="lineup-thumb">
                      <Cover game={g} label="" />
                    </span>
                    <span className="lineup-title">
                      <h3>{g.title}</h3>
                      <p>
                        <span className="by">{catalog.creatorName(g)}</span> · {g.tagline}
                      </p>
                    </span>
                    <TrackChip id={g.track} />
                    <PlatformCodes platforms={g.platforms} />
                    <span className="price-tag">{shortPrice(g.price)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          )}
        </div>
      </section>

      {/* Track bands */}
      {TRACKS.map((t, i) => {
        const games = catalog.games.filter((g) => g.track === t.id);
        const [lead, ...rest] = games;
        return (
          <section
            key={t.id}
            id={`trilha-${t.id}`}
            className={`band${t.on === "--paper" ? " on-field" : ""}`}
            data-flip={i % 2 === 1}
            style={trackStyle(t.id)}
            aria-labelledby={`t-${t.id}`}
          >
            <div className="wrap">
              <div className="band-intro">
                <h2 id={`t-${t.id}`}>{t.name}</h2>
                <p>{t.blurb}</p>
                {lead ? (
                  <div className="count">
                    <Link href={`/jogos?trilha=${t.id}`} className="btn btn--ghost">
                      Ver {games.length === 1 ? "a entrada" : `as ${games.length} entradas`} <ArrowRight aria-hidden />
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className="band-entries" data-empty={!lead || undefined}>
                {lead ? <Entry game={lead} variant="lead" /> : null}
                <div className="band-more">
                  {rest.slice(0, 3).map((g) => (
                    <Entry key={g.slug} game={g} variant="row" />
                  ))}
                  {rest.length < 3 && (
                    <Link href="/publicar" className="open-slot">
                      <span>
                        <strong>Vaga aberta em {t.name}</strong>
                        <span>
                          {lead
                            ? "Esta trilha tem lugar para o próximo jogo. Pode ser o seu."
                            : "Nenhum jogo nesta trilha ainda. O primeiro pode ser o seu."}
                        </span>
                      </span>
                      <ArrowRight aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* For creators: claim beside proof */}
      <section className="section" aria-labelledby="criar">
        <div className="wrap">
          <div className="section-head">
            <h2 id="criar">Para quem faz</h2>
            <div className="aside">
              <p>Cada ponto vem com a peça do site que mostra como ele funciona.</p>
              <Link href="/publicar" className="btn">
                Começar a publicar <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>

          <div className="pitch">
            <div>
              <h3>Você escolhe o modelo de preço.</h3>
              <p>
                Grátis, valor fixo ou pague o que quiser, com mínimo opcional. Os pagamentos ainda não estão ligados,
                então por enquanto só jogos grátis entram no programa.
              </p>
            </div>
            <div className="pitch-proof">
              <PriceDemo />
            </div>
          </div>

          <div className="pitch">
            <div>
              <h3>Jogos de navegador rodam na página.</h3>
              <p>
                Um .zip com um index.html na raiz vira a tela do jogo, e quem joga só precisa de um clique. Unity, Godot,
                Construct, GameMaker e HTML5 rodam aqui; builds de até 3 GB para desktop e Android ficam para baixar.
              </p>
            </div>
            <div className="pitch-proof">
              <span className="field-label">seu-jogo-web.zip</span>
              <ul className="filetree">
                <li className="is-entry">
                  <span>index.html</span>
                  <span>abre primeiro</span>
                </li>
                <li>
                  <span>jogo.js</span>
                </li>
                <li>
                  <span>sons/</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pitch">
            <div>
              <h3>Uma página que é sua.</h3>
              <p>O formulário de publicação edita a própria entrada do programa. O que você vê enquanto escreve é o que vai ao ar.</p>
            </div>
            <div className="pitch-proof">
              <EditDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Jams */}
      <section className="section" style={{ paddingTop: 0 }} aria-labelledby="agenda">
        <div className="wrap">
          <div className="section-head">
            <h2 id="agenda">Agenda de jams</h2>
            <div className="aside">
              <p>Maratonas com tema e prazo. As entradas caem no programa quando o relógio zera, ou na hora do envio, conforme a jam.</p>
              <Link href="/jams" className="btn btn--ghost btn--sm">
                Todas as jams
              </Link>
            </div>
          </div>
          {JAMS.length === 0 ? (
            <EmptyProgramme title="Nenhuma jam na agenda" action={null} secondary={{ href: "/jams", label: "Como funcionam as jams" }}>
              Jams são maratonas com tema e prazo. Quando uma for marcada, ela aparece aqui numa linha do tempo, com a
              marca de agora.
            </EmptyProgramme>
          ) : (
            <JamSchedule serverNow={now} />
          )}
        </div>
      </section>
    </>
  );
}

// "Hoje" and the jam schedule follow pickNow(); publishing also rebuilds the page at once.
export const revalidate = 60;

