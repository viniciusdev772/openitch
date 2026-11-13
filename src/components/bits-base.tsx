// Programme furniture that needs no catalogue data: platform codes, track chips,
// the entry card. Client components import from here so the catalogue
// (GAMES, CREATORS) stays out of their bundle; "./bits" adds the creator
// lookup on top for pages that already have the catalogue.

import Link from "next/link";
import { Play } from "lucide-react";
import { PLATFORMS, type Game, type Platform, type TrackId, entryNumber, shortPrice, trackById } from "@/data/base";
import { Cover } from "./Cover";
import { tagHref } from "./etiquetas/slug";
import "@/styles/etiquetas.css";

const ALL: Platform[] = ["web", "windows", "macos", "linux", "android"];

export function PlatformCodes({ platforms, compact = false }: { platforms: Platform[]; compact?: boolean }) {
  const list = compact ? platforms : ALL;
  return (
    <span className="codes" aria-label={`Plataformas: ${platforms.map((p) => PLATFORMS[p].name).join(", ")}`}>
      {list.map((p) => (
        <span key={p} className="code" data-on={platforms.includes(p)} title={PLATFORMS[p].name} aria-hidden>
          {PLATFORMS[p].code}
        </span>
      ))}
    </span>
  );
}

export function TrackChip({ id }: { id: TrackId }) {
  const t = trackById(id);
  return (
    <span className="chip-track" style={{ "--c": `var(${t.color})` } as React.CSSProperties}>
      <i aria-hidden />
      {t.name}
    </span>
  );
}

export function trackStyle(id: TrackId): React.CSSProperties {
  const t = trackById(id);
  return { "--c": `var(${t.color})`, "--on": `var(${t.on})` } as React.CSSProperties;
}

export interface EntryProps {
  game: Game;
  variant?: "card" | "lead" | "row" | "wide";
  showTrack?: boolean;
  link?: boolean;
  /** Print the game's tags, each linking to its tag page (cards show three). */
  showTags?: boolean;
  /** The creator's printed name. Without it the card prints game.creator as it is. */
  creatorName?: string;
}

export function Entry({ game, variant = "card", showTrack = false, link = true, showTags = false, creatorName }: EntryProps) {
  const by = creatorName ?? game.creator;
  const playsHere = game.platforms.includes("web");
  const cls = variant === "lead" ? "entry entry--lead" : variant === "row" ? "entry entry--row" : variant === "wide" ? "entry entry--wide" : "entry";
  const tags = showTags && variant !== "row" ? (variant === "card" ? game.tags.slice(0, 3) : game.tags) : [];
  // With tags to link, the card cannot be one big link (links do not nest):
  // the title carries the link and stretches over the card, the tags sit above it.
  const split = link && tags.length > 0;
  const Tag = (link && !split ? Link : "div") as React.ElementType;
  const href = `/jogo/${game.slug}`;
  return (
    <Tag {...(link && !split ? { href } : {})} className={split ? `${cls} entry--split` : cls}>
      <div className="entry-art">
        <Cover game={game} label="" />
        {playsHere && variant !== "row" && (
          <span className="play-flag">
            <Play aria-hidden fill="currentColor" /> Joga aqui
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: variant === "row" ? 4 : 8 }}>
        <div className="entry-line">
          <span className="num">{entryNumber(game.number)}</span>
          {showTrack ? <TrackChip id={game.track} /> : <PlatformCodes platforms={game.platforms} compact />}
        </div>
        <h3>
          {split ? (
            <Link className="entry-link" href={href}>
              {game.title}
            </Link>
          ) : (
            game.title
          )}
        </h3>
        {variant !== "row" && <p className="tagline">{game.tagline}</p>}
        {tags.length > 0 && (
          <ul className="tags entry-tags" aria-label="Etiquetas">
            {tags.map((t) => {
              const to = link ? tagHref(t) : null;
              return <li key={t}>{to ? <Link href={to}>{t}</Link> : <span>{t}</span>}</li>;
            })}
          </ul>
        )}
        {variant === "row" && <p className="tagline">{by}</p>}
        {variant !== "row" && (
          <div className="foot">
            <span className="by">{by}</span>
            <span className="price-tag">{shortPrice(game.price)}</span>
          </div>
        )}
      </div>
    </Tag>
  );
}

/** Junta nós como numa frase: "A", "A e B", "A, B e C". */
export function Joined({ children }: { children: React.ReactNode[] }) {
  const items = children.filter(Boolean);
  return (
    <>
      {items.map((c, i) => (
        <span key={i}>
          {c}
          {i < items.length - 2 ? ", " : i === items.length - 2 ? " e " : ""}
        </span>
      ))}
    </>
  );
}
