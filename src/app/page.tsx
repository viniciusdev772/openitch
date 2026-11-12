import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  GAMES,
  TRACKS,
  creatorBySlug,
  entryNumber,
  formatDay,
  formatTime,
  gameBySlug,
  gamesByNewest,
  shortPrice,
} from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { OrbitaGame } from "@/components/OrbitaGame";
import { PriceDemo } from "@/components/PriceDemo";
import { JamSchedule } from "@/components/JamSchedule";
import { EditDemo } from "@/components/EditDemo";
import { Entry, PlatformCodes, TrackChip, trackStyle } from "@/components/bits";

export default function Home() {
  const orbita = gameBySlug("orbita")!;
  const lineup = gamesByNewest().slice(0, 7);

  return (
    <>

      {/* Programme cover */}
      <section className="cover on-field" aria-labelledby="capa-titulo">
        <div className="wrap">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1 id="capa-titulo" className="cover-title">
              open<em>itch</em>
            </h1>
            <p className="cover-hook">
              Um festival de jogos independentes que nunca fecha. Publique o seu hoje, pelo preço que quiser, ou de graça.
            </p>
            <form className="cover-search" action="/jogos" role="search">
              <label htmlFor="busca-capa" className="visually-hidden">
                Buscar jogos
              </label>
              <input
                id="busca-capa"
                name="q"
                className="input"
                placeholder="Jogo, criador ou tag"
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

          <div className="screening" aria-label="Em cartaz agora">
            <div className="screening-head">
              <span className="live-dot" style={{ color: "var(--lime)" }}>
                Em cartaz agora
              </span>
              <span className="num">{entryNumber(orbita.number)}</span>
            </div>
            <div className="screening-stage">
              <OrbitaGame />
            </div>
            <div className="screening-foot">
              <div>
                <h2>{orbita.title}</h2>
                <p>
                  {creatorBySlug(orbita.creator)?.name} · roda aqui, sem instalar ·{" "}
                  <strong style={{ color: "var(--lime)" }}>{shortPrice(orbita.price)}</strong>
                </p>
              </div>
              <Link href={`/jogo/${orbita.slug}`} className="btn btn--lime btn--sm">
                Página do jogo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Today's lineup: screening schedule */}
      <section className="section" aria-labelledby="hoje">
        <div className="wrap">
          <div className="section-head">
            <h2 id="hoje">Hoje no programa</h2>
            <div className="aside">
              <p>
                Tudo que entrou no programa, na ordem em que chegou. Nada de ranking de vendas: o que é novo fica no topo.
              </p>
              <Link href="/jogos" className="btn btn--ghost btn--sm">
                Catálogo completo
              </Link>
            </div>
          </div>
          <ol className="lineup">
            {lineup.map((g) => {
              const isToday = g.published.startsWith("2026-11-12");
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
                        <span className="by">{creatorBySlug(g.creator)?.name}</span> · {g.tagline}
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
        </div>
      </section>

      {/* Track bands */}
      {TRACKS.map((t, i) => {
        const games = GAMES.filter((g) => g.track === t.id);
        const [lead, ...rest] = games;
        if (!lead) return null;
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
                <div className="count">
                  <Link href={`/jogos?trilha=${t.id}`} className="btn btn--ghost">
                    Ver as {games.length} entradas <ArrowRight aria-hidden />
                  </Link>
                </div>
              </div>
              <div className="band-entries">
                <Entry game={lead} variant="lead" />
                <div className="band-more">
                  {rest.slice(0, 3).map((g) => (
                    <Entry key={g.slug} game={g} variant="row" />
                  ))}
                  {rest.length < 3 && (
                    <Link href="/publicar" className="open-slot">
                      <span>
                        <strong>Vaga aberta em {t.name}</strong>
                        <span>Esta trilha tem lugar para o próximo jogo. Pode ser o seu.</span>
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
              <p>Três promessas, cada uma ao lado da peça que a cumpre.</p>
              <Link href="/publicar" className="btn">
                Começar a publicar <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>

          <div className="pitch">
            <div>
              <h3>Você decide o preço. Inclusive nenhum.</h3>
              <p>Grátis, valor fixo ou pague o que quiser com um mínimo opcional. Mude quando quiser, sem pedir a ninguém.</p>
            </div>
            <div className="pitch-proof">
              <PriceDemo />
            </div>
          </div>

          <div className="pitch">
            <div>
              <h3>Seu jogo roda aqui mesmo.</h3>
              <p>
                Como a Órbita lá em cima: envie um .zip com um index.html e a página do jogo vira a tela. Para quem joga, é um clique.
              </p>
            </div>
            <div className="pitch-proof">
              <span className="field-label">orbita-web.zip</span>
              <ul className="filetree">
                <li className="is-entry">
                  <span>index.html</span>
                  <span>2 KB</span>
                </li>
                <li>
                  <span>jogo.js</span>
                  <span>9 KB</span>
                </li>
                <li>
                  <span>sons/estrela.ogg</span>
                  <span>14 KB</span>
                </li>
                <li>
                  <span>sons/colisao.ogg</span>
                  <span>11 KB</span>
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
              <p>Maratonas com tema e prazo. As entradas caem direto no programa quando o relógio zera.</p>
              <Link href="/jams" className="btn btn--ghost btn--sm">
                Todas as jams
              </Link>
            </div>
          </div>
          <JamSchedule />
        </div>
      </section>
    </>
  );
}

export const dynamic = "force-static";

