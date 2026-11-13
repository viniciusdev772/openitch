import Link from "next/link";
import { Play } from "lucide-react";
import {
  PLATFORMS,
  type Game,
  type Platform,
  type TrackId,
  creatorBySlug,
  entryNumber,
  shortPrice,
  trackById,
} from "@/data/catalog";
import { Cover } from "./Cover";

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

export function Entry({
  game,
  variant = "card",
  showTrack = false,
  link = true,
}: {
  game: Game;
  variant?: "card" | "lead" | "row" | "wide";
  showTrack?: boolean;
  link?: boolean;
}) {
  const creator = creatorBySlug(game.creator) ?? { name: game.creator };
  const playsHere = game.platforms.includes("web");
  const cls = variant === "lead" ? "entry entry--lead" : variant === "row" ? "entry entry--row" : variant === "wide" ? "entry entry--wide" : "entry";
  const Tag = (link ? Link : "div") as React.ElementType;
  return (
    <Tag {...(link ? { href: `/jogo/${game.slug}` } : {})} className={cls}>
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
        <h3>{game.title}</h3>
        {variant !== "row" && <p className="tagline">{game.tagline}</p>}
        {variant === "row" && <p className="tagline">{creator?.name}</p>}
        {variant !== "row" && (
          <div className="foot">
            <span className="by">{creator?.name}</span>
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
