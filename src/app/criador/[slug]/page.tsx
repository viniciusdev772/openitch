import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CREATORS, GAMES, creatorBySlug } from "@/data/catalog";
import { Entry } from "@/components/bits";
import { LibraryButton } from "@/components/library/LibraryButton";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CREATORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = creatorBySlug(slug);
  return c ? { title: c.name } : {};
}

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  const creator = creatorBySlug(slug);
  if (!creator) notFound();
  const games = GAMES.filter((g) => g.creator === slug);
  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <h1>{creator.name}</h1>
          <div className="creator-head-side">
            <p>
              {creator.city}. {creator.bio}
            </p>
            <LibraryButton kind="follow" slug={creator.slug} />
          </div>
        </div>
      </header>
      <section className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }} aria-label="Jogos">
        <div className="results-bar">
          <p>
            <span className="num">{games.length}</span> {games.length === 1 ? "entrada" : "entradas"} no programa
          </p>
        </div>
        <div className="results">
          {games.map((g) => (
            <Entry key={g.slug} game={g} showTrack />
          ))}
        </div>
      </section>
    </>
  );
}
