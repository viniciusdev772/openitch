"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BookmarkCheck, LibraryBig } from "lucide-react";
import {
  CREATORS,
  GAMES,
  creatorBySlug,
  gameBySlug,
  shortPrice,
  type Game,
} from "@/data/catalog";
import { PlatformCodes, TrackChip, trackStyle } from "@/components/bits";
import { LIBRARY_COPY } from "./copy";
import { LibraryToggle } from "./LibraryToggle";

interface Item {
  slug: string;
  at: string;
}

const NEWS_LIMIT = 12;
const TZ = "America/Sao_Paulo";
const DAY = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ });
const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TZ });
/** "13" e "nov", sem o "de" e sem o ponto da abreviação. */
const dayParts = (iso: string) => [DAY.format(new Date(iso)), MONTH.format(new Date(iso)).replace(".", "")] as const;
const shortDay = (iso: string) => dayParts(iso).join(" ");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A estante de quem está dentro. As listas são uma foto do momento em que a
 * página abriu: tirar um item não o faz sumir (fica riscado, com o botão para
 * desfazer), então o foco do teclado nunca se perde. Contagens e Novidades
 * acompanham cada clique.
 */
export function Shelf({ saves, follows }: { saves: Item[]; follows: Item[] }) {
  const [savedRows] = useState(saves);
  const [followRows] = useState(follows);
  // Quem fez o que você guardou e você ainda não segue: sugestão com o botão ali mesmo.
  const [suggested] = useState(() =>
    follows.length > 0
      ? []
      : [...new Set(saves.map((s) => gameBySlug(s.slug)?.creator).filter((c): c is string => Boolean(c)))].slice(0, 4),
  );
  const [saved, setSaved] = useState(() => new Map(saves.map((s) => [s.slug, true])));
  const [followed, setFollowed] = useState(() => new Map(follows.map((f) => [f.slug, true])));

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
  const news = useMemo(
    () =>
      GAMES.filter((g) => followed.get(g.creator))
        .sort((a, b) => +new Date(b.published) - +new Date(a.published)),
    [followed],
  );

  if (savedRows.length === 0 && followRows.length === 0) return <FirstUse />;

  return (
    <div className="wrap shelf">
      <section className="acc-section shelf-saved" aria-labelledby="guardados">
        <div className="acc-head">
          <h2 id="guardados">Jogos guardados</h2>
          <span className="acc-count" aria-label={`${savedCount} guardados`}>
            {pad(savedCount)}
          </span>
        </div>
        {savedRows.length > 0 ? (
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
              {savedRows.map((s) => {
                const g = gameBySlug(s.slug);
                return g ? (
                  <SavedRow key={s.slug} game={g} at={s.at} on={saved.get(s.slug) ?? false} onChange={setSave} />
                ) : null;
              })}
            </ol>
          </>
        ) : (
          <div className="shelf-empty">
            <p>
              <strong>Nenhum jogo guardado ainda.</strong> Na página de um jogo, use{" "}
              <ButtonReplica kind="save" /> e ele fica aqui com a data em que você guardou.
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
          {followRows.length > 0 ? (
            <ol className="shelf-list shelf-list--people">
              {followRows.map((f) => (
                <PersonRow key={f.slug} slug={f.slug} at={f.at} on={followed.get(f.slug) ?? false} onChange={setFollow} />
              ))}
            </ol>
          ) : (
            <div className="shelf-empty">
              <p>
                <strong>Você ainda não segue ninguém.</strong> Seguir um criador traz os jogos novos dele para
                Novidades.{suggested.length > 0 ? " Comece por quem fez o que você guardou:" : ""}
              </p>
              {suggested.length > 0 ? (
                <ol className="shelf-list shelf-list--people">
                  {suggested.map((slug) => (
                    <PersonRow key={slug} slug={slug} on={followed.get(slug) ?? false} onChange={setFollow} />
                  ))}
                </ol>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SavedRow({
  game,
  at,
  on,
  onChange,
}: {
  game: Game;
  at: string;
  on: boolean;
  onChange: (slug: string, on: boolean) => void;
}) {
  const creator = creatorBySlug(game.creator);
  const report = useCallback((v: boolean) => onChange(game.slug, v), [onChange, game.slug]);
  return (
    <li style={trackStyle(game.track)} data-off={!on || undefined}>
      <span className="shelf-no">{String(game.number).padStart(4, "0")}</span>
      <span className="shelf-title">
        <Link href={`/jogo/${game.slug}`}>
          <h3>{game.title}</h3>
        </Link>
        <small>{creator?.name}</small>
      </span>
      <span className="shelf-meta">
        <TrackChip id={game.track} />
        <PlatformCodes platforms={game.platforms} />
        <span className="price-tag">{shortPrice(game.price)}</span>
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

function NewsRow({ game, saved }: { game: Game; saved: boolean }) {
  const creator = creatorBySlug(game.creator);
  return (
    <li style={trackStyle(game.track)}>
      <time className="shelf-no shelf-no--date" dateTime={game.published}>
        {dayParts(game.published)[0]}
        <small>{dayParts(game.published)[1]}</small>
      </time>
      <span className="shelf-title">
        <Link href={`/jogo/${game.slug}`}>
          <h3>{game.title}</h3>
        </Link>
        <small>
          {creator?.name} · {game.tagline}
        </small>
      </span>
      <span className="shelf-meta">
        <TrackChip id={game.track} />
        <span className="price-tag">{shortPrice(game.price)}</span>
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
  slug,
  at,
  on,
  onChange,
}: {
  slug: string;
  at?: string;
  on: boolean;
  onChange: (slug: string, on: boolean) => void;
}) {
  const creator = creatorBySlug(slug);
  const report = useCallback((v: boolean) => onChange(slug, v), [onChange, slug]);
  if (!creator) return null;
  const count = GAMES.filter((g) => g.creator === slug).length;
  return (
    <li data-off={(at && !on) || undefined}>
      <span className="shelf-title">
        <Link href={`/criador/${slug}`}>
          <h3>{creator.name}</h3>
        </Link>
        <small>
          {creator.city} · <span className="num">{count}</span> {count === 1 ? "jogo" : "jogos"} no programa
          {at ? (
            <>
              {" "}
              · desde <time dateTime={at}>{shortDay(at)}</time>
            </>
          ) : null}
        </small>
      </span>
      <span className="shelf-act">
        <LibraryToggle kind="follow" slug={slug} initialOn={Boolean(at)} name={creator.name} small onChange={report} />
      </span>
    </li>
  );
}

/** Cópia inerte do botão, para mostrar onde ele fica em vez de descrevê-lo. */
function ButtonReplica({ kind }: { kind: "save" | "follow" }) {
  const copy = LIBRARY_COPY[kind];
  return (
    <span className="lib-replica">
      <copy.Off aria-hidden />
      {copy.off}
    </span>
  );
}

function FirstUse() {
  const creators = CREATORS.map((c) => ({ ...c, count: GAMES.filter((g) => g.creator === c.slug).length }));
  return (
    <div className="wrap shelf shelf--first">
      <section className="shelf-start" aria-labelledby="vazia">
        <LibraryBig aria-hidden className="shelf-start-icon" />
        <h2 id="vazia">Sua estante está vazia</h2>
        <p className="shelf-start-lead">
          Aqui ficam os jogos que você guardar para jogar depois, os criadores que você seguir e os jogos novos de
          cada um deles.
        </p>
        <ul className="shelf-how">
          <li>
            <ButtonReplica kind="save" />
            <p>
              <strong>Na página de um jogo.</strong> O jogo entra na lista com o preço e a data em que você guardou.
            </p>
          </li>
          <li>
            <ButtonReplica kind="follow" />
            <p>
              <strong>Na página de um criador.</strong> Cada jogo novo dele aparece em Novidades, o mais recente
              primeiro.
            </p>
          </li>
        </ul>
        <div className="shelf-start-go">
          <Link href="/jogos" className="btn">
            Abrir o catálogo
          </Link>
        </div>
      </section>

      <section className="acc-section shelf-people-pick" aria-labelledby="criadores">
        <div className="acc-head">
          <h2 id="criadores">Criadores no programa</h2>
        </div>
        <p className="acc-intro">Abra a página de quem te interessa e use Seguir.</p>
        <ol className="shelf-list shelf-list--people">
          {creators.map((c) => (
            <li key={c.slug}>
              <span className="shelf-title">
                <Link href={`/criador/${c.slug}`}>
                  <h3>{c.name}</h3>
                </Link>
                <small>
                  {c.city} · <span className="num">{c.count}</span> {c.count === 1 ? "jogo" : "jogos"}
                </small>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
