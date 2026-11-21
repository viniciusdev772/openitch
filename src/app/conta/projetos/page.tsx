import "@/styles/projetos.css";
import "@/styles/envios.css";
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
import { USER_QUOTA_BYTES, formatBytes } from "@/lib/storage/limits";
import { usageOf } from "@/lib/uploads/server";

export const metadata: Metadata = { title: "Seus jogos", robots: { index: false } };

export default async function ProjetosPage() {
  // null: o banco não respondeu. A página abre do mesmo jeito, dizendo isso e oferecendo tentar de novo.
  let drafts: DraftRow[] | null = null;
  let used: number | null = null;
  let signedIn = true;
  try {
    const session = await getSession();
    if (session) [drafts, used] = await Promise.all([listDrafts(session.user._id), usageOf(session.user._id)]);
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
        {used !== null ? <AccountSpace used={used} /> : null}
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

/** Quanto da conta os arquivos dos jogos ocupam, somados. */
function AccountSpace({ used }: { used: number }) {
  const pct = Math.min(100, Math.floor((used / USER_QUOTA_BYTES) * 100));
  return (
    <div className="pj-space">
      <p className="dl-quota">
        <span className="dl-quota-text">
          Espaço da conta: <span className="num">{formatBytes(used)}</span> de{" "}
          <span className="num">{formatBytes(USER_QUOTA_BYTES)}</span>
        </span>
        <span
          className="dl-meter"
          role="meter"
          aria-label="Espaço usado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}% usado`}
          data-full={pct >= 90 ? "true" : undefined}
        >
          <span style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
        </span>
      </p>
      <p className="pj-hint">
        É a soma dos arquivos para baixar e dos builds de navegador de todos os seus jogos, rascunhos e publicados.
        Capa e imagens não contam. Quando o espaço acaba, novos envios param; para liberar, abra um jogo e exclua os
        arquivos ou builds que não usa mais.
      </p>
    </div>
  );
}
