import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/styles/jams-criadores.css";
import {
  CREATORS,
  GAMES,
  JAMS,
  type Jam,
  creatorBySlug,
  formatDay,
  formatTime,
  shortPrice,
  trackById,
} from "@/data/catalog";
import { Cover } from "@/components/Cover";
import { PlatformCodes, TrackChip, trackStyle } from "@/components/bits";
import { JamClock, JamEntriesEmpty } from "@/components/jams/JamClock";
import { jamState, pickNow } from "@/components/jams/clock";

type Props = { params: Promise<{ slug: string }> };

/** Optional fields another part of the catalogue may add to Jam. */
type JamDetail = Jam & { rules?: string[]; criteria?: string[] };
type Item = { name?: string; text: string };

const jamBySlug = (slug: string) => JAMS.find((j) => j.slug === slug) as JamDetail | undefined;
const when = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

/** Rules written from what the jam already states: theme, summary and window. */
function derivedRules(j: Jam): Item[] {
  return [
    { name: "Tema", text: `O tema é “${j.theme}”. Qualquer leitura vale, desde que dê para reconhecer o tema jogando.` },
    { name: "Formato", text: j.summary },
    {
      name: "Prazo",
      text: `O jogo é feito entre ${when(j.start)} e ${when(j.end)}, horário de Brasília. Motor, bibliotecas e ferramentas feitas antes podem entrar; o jogo em si começa na abertura.`,
    },
    { name: "Equipe", text: "Sozinho ou em grupo, uma entrada por pessoa ou equipe." },
    { name: "Créditos", text: "Material de terceiros só com licença que permita o uso, com os créditos na página do jogo." },
    { name: "Envio", text: "Publique pelo openitch marcando esta jam. A página, o preço e os arquivos continuam sendo de quem fez." },
  ];
}

function derivedCriteria(j: Jam): Item[] {
  return [
    { name: "Tema", text: `Quanto o jogo conversa com “${j.theme}”, e por um caminho que ninguém mais tomou.` },
    { name: "Formato", text: "Se cumpre o formato da jam sem contornar a restrição." },
    { name: "Jogo", text: "Se dá vontade de jogar até o fim, ou de começar de novo." },
    { name: "Acabamento", text: "Se o que existe funciona: controles, texto e a primeira tela claros para quem chega." },
  ];
}

// O estado (encerrada, ao vivo, em breve) segue o relógio: refaz a cada 5 minutos.
export const revalidate = 300;

export function generateStaticParams() {
  return JAMS.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const j = jamBySlug(slug);
  return j ? { title: j.title, description: `Tema: ${j.theme}. ${j.summary}` } : {};
}

export default async function JamPage({ params }: Props) {
  const { slug } = await params;
  const jam = jamBySlug(slug);
  if (!jam) notFound();

  const track = trackById(jam.track);
  const past = jamState(jam, pickNow()) === "past";
  const host = CREATORS.find((c) => c.name === jam.host);
  const entries = GAMES.filter((g) => g.jam === jam.slug).sort(
    (a, b) => +new Date(a.published) - +new Date(b.published),
  );
  const rules: Item[] = jam.rules?.length ? jam.rules.map((text) => ({ text })) : derivedRules(jam);
  const criteria: Item[] = jam.criteria?.length ? jam.criteria.map((text) => ({ text })) : derivedCriteria(jam);
  const others = JAMS.filter((j) => j.slug !== jam.slug).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const days = Math.round((+new Date(jam.end) - +new Date(jam.start)) / 86400000);

  return (
    <>
      <header
        className={`page-head jam-head${track.on === "--paper" && !past ? " on-field" : ""}`}
        data-past={past || undefined}
        style={trackStyle(jam.track)}
      >
        <div className="wrap">
          <div className="jam-head-text">
            <nav className="crumbs" aria-label="Trilha de navegação">
              <Link href="/jams">Jams</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{jam.title}</span>
            </nav>
            <h1>{jam.title}</h1>
            <p className="jam-theme">
              Tema <strong>“{jam.theme}”</strong>
            </p>
            <p className="jam-summary">{jam.summary}</p>
          </div>
          <aside className="jam-sheet" aria-label="Situação da jam">
            <JamClock slug={jam.slug} start={jam.start} end={jam.end} />
            <dl className="jam-facts">
              <dt>Abertura</dt>
              <dd className="num">{when(jam.start)}</dd>
              <dt>Prazo</dt>
              <dd className="num">{when(jam.end)}</dd>
              <dt>Duração</dt>
              <dd className="num">{days <= 1 ? "1 dia" : `${days} dias`}</dd>
              <dt>Organiza</dt>
              <dd>{host ? <Link href={`/criador/${host.slug}`}>{host.name}</Link> : jam.host}</dd>
              <dt>Trilha</dt>
              <dd>
                <TrackChip id={jam.track} />
              </dd>
            </dl>
          </aside>
        </div>
      </header>

      <div className="wrap jam-body">
        <div className="jam-main">
          <section className="jam-section" aria-labelledby="regras">
            <h2 id="regras">Regras</h2>
            <ol className="jam-rules">
              {rules.map((r, i) => (
                <li key={i}>
                  <span className="jam-rules-no" aria-hidden>
                    {i + 1}
                  </span>
                  <p>
                    {r.name && <strong>{r.name}. </strong>}
                    {r.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="jam-section" aria-labelledby="criterios">
            <h2 id="criterios">Critérios</h2>
            <dl className="jam-criteria">
              {criteria.map((c, i) => (
                <div key={i}>
                  <dt>{c.name ?? `Critério ${i + 1}`}</dt>
                  <dd>{c.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="jam-side" aria-label="Organização e outras jams">
          <div className="creator-card">
            {host ? (
              <>
                <Link className="name" href={`/criador/${host.slug}`}>
                  {host.name}
                </Link>
                <p>
                  Organiza esta jam. {host.city}. {host.bio}
                </p>
              </>
            ) : (
              <>
                <span className="name">{jam.host}</span>
                <p>Organiza esta jam. Ainda não tem página de criador no programa.</p>
              </>
            )}
          </div>
          <nav className="jam-others" aria-labelledby="outras">
            <h2 id="outras">Outras jams</h2>
            <ul>
              {others.map((j) => (
                <li key={j.slug}>
                  <Link href={`/jams/${j.slug}`}>{j.title}</Link>
                  <span className="num">
                    {formatDay(j.start)} → {formatDay(j.end)}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>

      <section id="entradas" className="wrap jam-section jam-entries" aria-labelledby="entradas-titulo">
        <h2 id="entradas-titulo">
          Entradas {entries.length > 0 && <span className="num">{entries.length}</span>}
        </h2>
        {entries.length > 0 ? (
          <div className="index-list">
              <ol>
                {entries.map((g) => {
                  const by = creatorBySlug(g.creator);
                  return (
                    <li key={g.slug}>
                      <Link href={`/jogo/${g.slug}`} style={trackStyle(g.track)}>
                        <span className="no">{String(g.number).padStart(4, "0")}</span>
                        <span className="thumb">
                          <Cover game={g} label="" />
                        </span>
                        <span>
                          <h3>{g.title}</h3>
                          <p>
                            {by?.name ?? g.creator} · {g.tagline}
                          </p>
                        </span>
                        <PlatformCodes platforms={g.platforms} />
                        <span className="price-tag">{shortPrice(g.price)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {jam.entries > entries.length && (
                <p className="jam-entries-note">
                  <span className="num">{entries.length}</span> de <span className="num">{jam.entries}</span> entradas
                  aparecem aqui; as outras não fazem parte desta edição de demonstração.
                </p>
              )}
          </div>
        ) : (
          <JamEntriesEmpty slug={jam.slug} start={jam.start} end={jam.end} submitted={jam.entries} release={jam.release} />
        )}
      </section>
    </>
  );
}
