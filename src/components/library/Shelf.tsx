"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BookmarkCheck } from "lucide-react";
import { ButtonReplica } from "./ButtonReplica";
import { LibraryToggle } from "./LibraryToggle";
import type { ShelfData, ShelfGame, ShelfPerson, ShelfTrack } from "./shelf-types";

const NEWS_LIMIT = 12;
const TZ = "America/Sao_Paulo";
const DAY = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ });
const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TZ });
/** "13" e "nov", sem o "de" e sem o ponto da abreviação. */
const dayParts = (iso: string) => [DAY.format(new Date(iso)), MONTH.format(new Date(iso)).replace(".", "")] as const;
const shortDay = (iso: string) => dayParts(iso).join(" ");
const pad = (n: number) => String(n).padStart(2, "0");

const trackVars = (t: ShelfTrack) => ({ "--c": `var(${t.color})`, "--on": `var(${t.on})` }) as React.CSSProperties;

/**
 * A estante de quem está dentro. As listas são uma foto do momento em que a
 * página abriu: tirar um item não o faz sumir (fica riscado, com o botão para
 * desfazer), então o foco do teclado nunca se perde. Contagens, textos e
 * Novidades acompanham cada clique. Tudo o que é impresso chega pronto do
 * servidor (ShelfData); este componente não conhece o catálogo.
 */
export function Shelf({ data: fresh }: { data: ShelfData }) {
  // Foto do momento em que a página abriu: cada clique revalida /estante e
  // traria listas novas, o que faria sumir a linha (e o foco) que acabou de mudar.
  const [data] = useState(fresh);
  const [saved, setSaved] = useState(() => new Map(data.saved.map((s) => [s.game.slug, true])));
  const [followed, setFollowed] = useState(() => new Map(data.following.map((f) => [f.slug, true])));

  const setSave = useCallback(
    (slug: string, on: boolean) => setSaved((m) => (m.get(slug) === on ? m : new Map(m).set(slug, on))),
    [],
  );
  const setFollow = useCallback(
    (slug: string, on: boolean) => setFollowed((m) => (m.get(slug) === on ? m : new Map(m).set(slug, on))),
    [],
  );

  const savedCount = [...saved.values()].filter(Boolean).length;
  const followCount = [...followed.values()].filter(Boolean).length;
  const news = useMemo(() => data.news.filter((g) => followed.get(g.creator)), [data.news, followed]);

  return (
    <div className="wrap shelf">
      <section className="acc-section shelf-saved" aria-labelledby="guardados">
        <div className="acc-head">
          <h2 id="guardados">Jogos guardados</h2>
          <span className="acc-count" aria-label={`${savedCount} guardados`}>
            {pad(savedCount)}
          </span>
        </div>
        {data.saved.length > 0 ? (
          <>
            <div className="shelf-cols" aria-hidden>
              <span>Nº</span>
              <span>Jogo</span>
              <span>Trilha</span>
              <span>Plataformas</span>
              <span>Preço</span>
              <span>Guardado</span>
              <span />
            </div>
            <ol className="shelf-list shelf-list--games">
              {data.saved.map((s) => (
                <SavedRow
                  key={s.game.slug}
                  game={s.game}
                  at={s.at}
                  on={saved.get(s.game.slug) ?? false}
                  onChange={setSave}
                />
              ))}
            </ol>
          </>
        ) : (
          <div className="shelf-empty">
            <p>
              <strong>Nenhum jogo guardado ainda.</strong> Na página de um jogo, use <ButtonReplica kind="save" /> e
              ele fica aqui com a data em que você guardou.
            </p>
            <Link href="/jogos" className="btn btn--sm">
              Abrir o catálogo
            </Link>
          </div>
        )}
      </section>

      <div className="shelf-split">
        <section className="acc-section" aria-labelledby="novidades">
          <div className="acc-head">
            <h2 id="novidades">Novidades de quem você segue</h2>
            <span className="acc-count" aria-label={`${news.length} jogos`}>
              {pad(news.length)}
            </span>
          </div>
          {news.length > 0 ? (
            <>
              <ol className="shelf-list shelf-list--news">
                {news.slice(0, NEWS_LIMIT).map((g) => (
                  <NewsRow key={g.slug} game={g} saved={saved.get(g.slug) ?? false} />
                ))}
              </ol>
              {news.length > NEWS_LIMIT ? (
                <p className="shelf-more">
                  Mostrando os {NEWS_LIMIT} mais recentes de {news.length}. Os outros estão na página de cada criador.
                </p>
              ) : null}
            </>
          ) : (
            <div className="shelf-empty">
              <p>
                <strong>Nada por aqui ainda.</strong> Quando você segue um criador, os jogos dele aparecem nesta lista,
                do mais novo para o mais antigo.
              </p>
            </div>
          )}
        </section>

        <section className="acc-section" aria-labelledby="seguindo">
          <div className="acc-head">
            <h2 id="seguindo">Criadores que você segue</h2>
            <span className="acc-count" aria-label={`${followCount} criadores`}>
              {pad(followCount)}
            </span>
          </div>
          {data.following.length > 0 ? (
            <ol className="shelf-list shelf-list--people">
              {data.following.map((p) => (
                <PersonRow key={p.slug} person={p} on={followed.get(p.slug) ?? false} onChange={setFollow} />
              ))}
            </ol>
          ) : (
            <StartFollowing
              suggested={data.suggested}
              followed={followed}
              followCount={followCount}
              onChange={setFollow}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Quem ainda não segue ninguém. A lista de sugestões fica onde está (o foco
 * não se perde), mas o texto acompanha: depois do primeiro Seguir ele deixa
 * de dizer que você não segue ninguém.
 */
function StartFollowing({
  suggested,
  followed,
  followCount,
  onChange,
}: {
  suggested: ShelfPerson[];
  followed: Map<string, boolean>;
  followCount: number;
  onChange: (slug: string, on: boolean) => void;
}) {
  const names = suggested.filter((p) => followed.get(p.slug)).map((p) => p.name);
  return (
    <div className="shelf-empty" data-started={followCount > 0 || undefined}>
      <p aria-live="polite">
        {followCount > 0 ? (
          <>
            <strong>
              Você segue {names.length === 1 ? names[0] : `${names.length} criadores`}.
            </strong>{" "}
            Os jogos {names.length === 1 ? "dessa pessoa" : "deles"} já estão em Novidades.
          </>
        ) : (
          <>
            <strong>Você ainda não segue ninguém.</strong> Seguir um criador traz os jogos novos dele para Novidades.
            {suggested.length > 0 ? " Comece por quem fez o que você guardou:" : ""}
          </>
        )}
      </p>
      {suggested.length > 0 ? (
        <ol className="shelf-list shelf-list--people">
          {suggested.map((p) => (
            <PersonRow key={p.slug} person={p} on={followed.get(p.slug) ?? false} onChange={onChange} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function TrackChip({ track }: { track: ShelfTrack }) {
  return (
    <span className="chip-track" style={{ "--c": `var(${track.color})` } as React.CSSProperties}>
      <i aria-hidden />
      {track.name}
    </span>
  );
}

function PlatformCodes({ game }: { game: ShelfGame }) {
  const names = game.platforms.filter((p) => p.on).map((p) => p.name);
  return (
    <span className="codes" aria-label={`Plataformas: ${names.join(", ")}`}>
      {game.platforms.map((p) => (
        <span key={p.code} className="code" data-on={p.on} title={p.name} aria-hidden>
          {p.code}
        </span>
      ))}
    </span>
  );
}

function SavedRow({
  game,
  at,
  on,
  onChange,
}: {
  game: ShelfGame;
  at: string;
  on: boolean;
  onChange: (slug: string, on: boolean) => void;
}) {
  const report = useCallback((v: boolean) => onChange(game.slug, v), [onChange, game.slug]);
  return (
    <li style={trackVars(game.track)} data-off={!on || undefined}>
      <span className="shelf-no">{game.number}</span>
      <span className="shelf-title">
        <Link href={`/jogo/${game.slug}`}>
          <h3>{game.title}</h3>
        </Link>
        <small>{game.creatorName}</small>
      </span>
      <span className="shelf-meta">
        <TrackChip track={game.track} />
        <PlatformCodes game={game} />
        <span className="price-tag">{game.price}</span>
        <time className="shelf-date" dateTime={at}>
          <span className="visually-hidden">guardado em </span>
          {shortDay(at)}
        </time>
      </span>
      <span className="shelf-act">
        <LibraryToggle kind="save" slug={game.slug} initialOn name={game.title} small onChange={report} />
      </span>
    </li>
  );
}

function NewsRow({ game, saved }: { game: ShelfGame; saved: boolean }) {
  const [day, month] = dayParts(game.published);
  return (
    <li style={trackVars(game.track)}>
      <time className="shelf-no shelf-no--date" dateTime={game.published}>
        {day}
        <small>{month}</small>
      </time>
      <span className="shelf-title">
        <Link href={`/jogo/${game.slug}`}>
          <h3>{game.title}</h3>
        </Link>
        <small>
          {game.creatorName} · {game.tagline}
        </small>
      </span>
      <span className="shelf-meta">
        <TrackChip track={game.track} />
        <span className="price-tag">{game.price}</span>
        {saved ? (
          <span className="shelf-flag">
            <BookmarkCheck aria-hidden size={16} />
            guardado
          </span>
        ) : null}
      </span>
    </li>
  );
}

function PersonRow({
  person,
  on,
  onChange,
}: {
  person: ShelfPerson;
  on: boolean;
  onChange: (slug: string, on: boolean) => void;
}) {
  const { slug, at } = person;
  const report = useCallback((v: boolean) => onChange(slug, v), [onChange, slug]);
  return (
    <li data-off={(at && !on) || undefined}>
      <span className="shelf-title">
        <Link href={`/criador/${slug}`}>
          <h3>{person.name}</h3>
        </Link>
        <small>
          {person.city} · <span className="num">{person.count}</span> {person.count === 1 ? "jogo" : "jogos"} no
          programa
          {at ? (
            <>
              {" "}
              · desde <time dateTime={at}>{shortDay(at)}</time>
            </>
          ) : null}
        </small>
      </span>
      <span className="shelf-act">
        <LibraryToggle kind="follow" slug={slug} initialOn={Boolean(at)} name={person.name} small onChange={report} />
      </span>
    </li>
  );
}
