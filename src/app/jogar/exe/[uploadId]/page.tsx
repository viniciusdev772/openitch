import "@/styles/jogavel.css";
import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { storageConfigured } from "@/lib/storage/s3";
import { exeForPlay, exeLauncherUrl, ExeRuntimeMissing } from "@/lib/builds/exe-server";
import { TRACKS, trackById } from "@/data/catalog";
import { trackStyle } from "@/components/bits";
import { ExePlayer } from "@/components/builds/ExePlayer";

/*
 * Um download de Windows (.exe ou .zip) rodando no PC de quem joga, dentro
 * do navegador (Boxedwine, ver src/lib/builds/exe.ts). Esta página só confere
 * quem pode ver e entrega dois endereços: a página do Boxedwine no bucket
 * jogável e /baixar/<id>, de onde o navegador pega a URL curta do arquivo.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Jogar no navegador",
  robots: { index: false, follow: true },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ uploadId: string }> };

export default async function ExePlayPage({ params }: Props) {
  const { uploadId } = await params;
  if (!/^[a-f0-9]{24}$/.test(uploadId)) notFound();
  if (!storageConfigured()) {
    return <Notice title="Jogo indisponível">O armazenamento de arquivos ainda não está configurado neste servidor.</Notice>;
  }

  let found: Awaited<ReturnType<typeof exeForPlay>> = null;
  let viewer: { _id: import("mongodb").ObjectId } | null = null;
  // null: o Boxedwine ainda não está no bucket; o jogador pede a instalação (só na primeira vez).
  let launcher: string | null = null;
  try {
    viewer = (await getSession())?.user ?? null;
    found = await exeForPlay(viewer, uploadId);
    if (!found && !viewer) redirect(`/entrar?de=${encodeURIComponent(`/jogar/exe/${uploadId}`)}`);
    if (!found) notFound();
    launcher = await exeLauncherUrl().catch((err) => {
      if (err instanceof ExeRuntimeMissing) return null;
      throw err;
    });
  } catch (err) {
    unstable_rethrow(err);
    console.error("[jogar/exe]", err);
    return <Notice title="Jogo fora do ar">Não conseguimos abrir o jogo agora. Tente de novo em instantes.</Notice>;
  }

  if (!found) notFound();
  const { upload, project } = found;
  const owner = Boolean(viewer && project.userId.equals(viewer._id));
  const published = project.status === "publicado" && project.publicSlug;
  const back =
    owner || !published
      ? { href: `/publicar?projeto=${project._id.toHexString()}`, label: "Voltar ao rascunho" }
      : { href: `/jogo/${project.publicSlug}`, label: "Página do jogo" };
  const trackId = TRACKS.some((t) => t.id === project.track) ? project.track : "experimental";
  const track = trackById(trackId);

  return (
    <section className={`play-stage${track.on === "--paper" ? " on-field" : ""}`} style={trackStyle(trackId)} aria-label="Jogo para Windows">
      <div className="wrap">
        <ExePlayer
          launcher={launcher}
          canInstall={Boolean(viewer)}
          title={project.title || "Jogo sem título"}
          filename={upload.filename}
          size={upload.size}
          fileHref={`/baixar/${uploadId}`}
          back={back}
        />
      </div>
    </section>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wrap play-notice">
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
