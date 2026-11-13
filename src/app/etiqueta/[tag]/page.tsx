import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import "@/styles/etiquetas.css";
import { creatorBySlug, shortPrice, trackById } from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { TrackChip, trackStyle } from "@/components/bits";
import { tagSlug } from "@/components/etiquetas/slug";
import { relatedTags, tagBySlug, tagIndex, type TagInfo } from "@/components/etiquetas/tags";

type Props = { params: Promise<{ tag: string }> };

export function generateStaticParams() {
  return tagIndex().map((t) => ({ tag: t.slug }));
}

/**
 * Turns whatever came in the address into a known tag. The segment may arrive
 * encoded or not, with accents or capitals ("F%C3%ADsica", "Física"); it is
 * folded to a slug and looked up in the index. Nothing from the address is
 * used beyond that lookup.
 */
function resolve(raw: string): { info?: TagInfo; canonical: boolean } {
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Malformed escape: fold the raw text as it is.
  }
  const slug = tagSlug(text.slice(0, 120));
  const info = slug ? tagBySlug(slug) : undefined;
  return { info, canonical: info?.slug === raw };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const { info } = resolve(tag);
  if (!info) return { title: "Etiqueta não encontrada" };
  return {
    title: `Etiqueta: ${info.tag}`,
    description: `${info.count} ${info.count === 1 ? "jogo leva" : "jogos levam"} a etiqueta “${info.tag}” no catálogo da VibeGames.`,
    alternates: { canonical: `/etiqueta/${info.slug}` },
  };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const { info, canonical } = resolve(tag);
  if (!info) notFound();
  // Any other spelling of a known tag goes to its one address. The target is
  // built from the index, never from the request.
  if (!canonical) permanentRedirect(`/etiqueta/${info.slug}`);

  const related = relatedTags(info);
  const catalogHref = `/jogos?etiqueta=${info.slug}`;

  return (
    <>
      <header className="page-head tag-head">
        <div className="wrap">
          <div className="tag-head-text">
            <nav className="crumbs" aria-label="Trilha de navegação">
              <Link href="/etiquetas">Etiquetas</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{info.tag}</span>
            </nav>
            <h1>{info.tag}</h1>
          </div>
          <p>
            <span className="num">{info.count}</span>{" "}
            {info.count === 1 ? "jogo do programa leva" : "jogos do programa levam"} esta etiqueta
            {info.tracks.length > 1 ? (
              <>
                , espalhados por <span className="num">{info.tracks.length}</span> trilhas.
              </>
            ) : (
              <>, todos na trilha {trackById(info.tracks[0].id).name}.</>
            )}{" "}
            Quem publica escolhe as etiquetas do próprio jogo.
          </p>
        </div>
      </header>

      <div className="wrap tag-page">
        <section className="index-list tag-games" aria-labelledby="jogos-etiqueta">
          <h2 id="jogos-etiqueta">Jogos com “{info.tag}”</h2>
          <ol>
            {info.games.map((g) => (
              <li key={g.slug}>
                <Link href={`/jogo/${g.slug}`} style={trackStyle(g.track)}>
                  <span className="no">{String(g.number).padStart(4, "0")}</span>
                  <span className="thumb">
                    <Cover game={g} label="" />
                  </span>
                  <span>
                    <h3>{g.title}</h3>
                    <p>
                      {g.tagline} <span className="tag-by">{creatorBySlug(g.creator)?.name}</span>
                    </p>
                  </span>
                  <TrackChip id={g.track} />
                  <span className="price-tag">{shortPrice(g.price)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <aside className="tag-aside" aria-label="Mais sobre esta etiqueta">
          <section aria-labelledby="trilhas-etiqueta">
            <h2 id="trilhas-etiqueta">Trilhas</h2>
            <ul className="tag-tracks">
              {info.tracks.map((t) => (
                <li key={t.id} style={trackStyle(t.id)}>
                  <Link href={`${catalogHref}&trilha=${t.id}`}>
                    <span className="tag-track-name">
                      <i aria-hidden />
                      {trackById(t.id).name}
                    </span>
                    <span className="tag-count">
                      <span className="num">{t.count}</span> <span className="unit">{t.count === 1 ? "jogo" : "jogos"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {related.length > 0 && (
            <section aria-labelledby="relacionadas">
              <h2 id="relacionadas">Aparece junto com</h2>
              <ul className="tags tag-related">
                {related.map(({ info: r, together }) => (
                  <li key={r.slug}>
                    <Link
                      href={`/etiqueta/${r.slug}`}
                      aria-label={`${r.tag}, junto em ${together} ${together === 1 ? "jogo" : "jogos"}`}
                    >
                      {r.tag} <span className="num">{together}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="tag-note">O número diz em quantos destes jogos as duas etiquetas aparecem juntas.</p>
            </section>
          )}

          <div className="tag-aside-actions">
            <Link className="btn btn--ghost btn--sm" href={catalogHref}>
              Filtrar o catálogo por esta etiqueta <ArrowRight aria-hidden />
            </Link>
            <Link className="tag-back" href="/etiquetas">
              Todas as etiquetas
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
