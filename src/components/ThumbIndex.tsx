import Link from "next/link";
import { TRACKS } from "@/data/catalog";

/** Programme thumb-index tabs on the page edge, one per track. */
export function ThumbIndex({ mode = "catalog" }: { mode?: "home" | "catalog" }) {
  return (
    <nav className="thumb-index" aria-label="Trilhas do programa">
      {TRACKS.map((t) => (
        <Link
          key={t.id}
          href={mode === "home" ? `/#trilha-${t.id}` : `/jogos?trilha=${t.id}`}
          style={{ "--c": `var(${t.color})`, "--on": `var(${t.on})` } as React.CSSProperties}
        >
          {t.name}
        </Link>
      ))}
    </nav>
  );
}
