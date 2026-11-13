import "@/styles/projetos.css";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JAMS } from "@/data/jams";
import { jamState, pickNow } from "@/components/jams/clock";
import { BoxHead } from "@/components/auth/BoxOffice";
import { DraftList, type OpenJam } from "@/components/projetos/DraftList";
import { getSession } from "@/lib/auth/session";
import { listDrafts } from "@/lib/projects/rules";
import { LIMITS, type DraftRow } from "@/lib/projects/limits";

export const metadata: Metadata = { title: "Seus jogos", robots: { index: false } };

export default async function ProjetosPage() {
  // null: o banco não respondeu. A página abre do mesmo jeito, dizendo isso e oferecendo tentar de novo.
  let drafts: DraftRow[] | null = null;
  let signedIn = true;
  try {
    const session = await getSession();
    if (session) drafts = await listDrafts(session.user._id);
    else signedIn = false;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[conta/projetos]", err);
  }
  if (!signedIn) redirect("/entrar?de=/conta/projetos");

  const now = pickNow();
  const jamTitles = Object.fromEntries(JAMS.map((j) => [j.slug, j.title]));
  const openJams: OpenJam[] = JAMS.map((j) => ({ slug: j.slug, title: j.title, start: j.start, end: j.end, track: j.track, state: jamState(j, now) }))
    .filter((j) => j.state !== "past")
    .sort((a, b) => +new Date(a.end) - +new Date(b.end))
    .slice(0, 4);

  return (
    <>
      <BoxHead title="Seus jogos">
        <p>
          Os jogos que você começou em Publicar, rascunhos e publicados, do mais recente para o mais antigo. Abra
          um para editar tudo, tirar do ar ou excluir. Só você vê esta página.
          {drafts && drafts.length > 0 ? (
            <>
              {" "}
              Cabem <span className="num">{LIMITS.drafts}</span> jogos por conta, rascunhos e publicados somados.
            </>
          ) : null}
        </p>
      </BoxHead>
      <div className="wrap pj-page">
        <Link href="/conta" className="bo-back">
          <ArrowLeft aria-hidden size={18} />
          Sua conta
        </Link>
        {drafts ? (
          <DraftList drafts={drafts} jamTitles={jamTitles} openJams={openJams} max={LIMITS.drafts} />
        ) : (
          <div className="bo-sheet">
            <p className="bo-alert" role="alert">
              Não conseguimos carregar seus rascunhos agora. Nenhum foi apagado: eles continuam salvos na sua conta.
            </p>
            <div className="bo-row bo-row--end">
              {/* Um link comum, não <Link>: recarrega a página inteira e pergunta ao servidor de novo. */}
              <a href="/conta/projetos" className="btn">
                Tentar de novo
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
