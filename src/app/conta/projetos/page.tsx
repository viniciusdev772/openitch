import "@/styles/projetos.css";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JAMS } from "@/data/catalog";
import { jamState, pickNow } from "@/components/jams/clock";
import { BoxHead } from "@/components/auth/BoxOffice";
import { DraftList, type OpenJam } from "@/components/projetos/DraftList";
import { getSession } from "@/lib/auth/session";
import { listDrafts } from "@/lib/projects/rules";
import { LIMITS } from "@/lib/projects/limits";

export const metadata: Metadata = { title: "Seus rascunhos", robots: { index: false } };

export default async function ProjetosPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?de=/conta/projetos");
  const drafts = await listDrafts(session.user._id);

  const now = pickNow();
  const jamTitles = Object.fromEntries(JAMS.map((j) => [j.slug, j.title]));
  const openJams: OpenJam[] = JAMS.map((j) => ({ slug: j.slug, title: j.title, start: j.start, end: j.end, track: j.track, state: jamState(j, now) }))
    .filter((j) => j.state !== "past")
    .sort((a, b) => +new Date(a.end) - +new Date(b.end))
    .slice(0, 4);

  return (
    <>
      <BoxHead title="Seus rascunhos">
        <p>
          Os jogos que você começou em Publicar, do mais recente para o mais antigo. Só você vê esta página.
          {drafts.length > 0 ? (
            <>
              {" "}
              Cabem <span className="num">{LIMITS.drafts}</span> rascunhos por conta.
            </>
          ) : null}
        </p>
      </BoxHead>
      <div className="wrap pj-page">
        <Link href="/conta" className="bo-back">
          <ArrowLeft aria-hidden size={18} />
          Sua conta
        </Link>
        <DraftList drafts={drafts} jamTitles={jamTitles} openJams={openJams} max={LIMITS.drafts} />
      </div>
    </>
  );
}
