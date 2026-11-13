import "@/styles/jogavel.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { publicUrl, s3Config, storageConfigured } from "@/lib/storage/s3";
import { buildForPlay } from "@/lib/builds/server";
import { canView } from "@/lib/projects/access";
import { ENGINE_LABEL } from "@/lib/builds/detect";
import { HEAVY_BUILD_BYTES, PUBLIC_ID_RE } from "@/lib/builds/config";
import { TRACKS, trackById } from "@/data/catalog";
import { trackStyle } from "@/components/bits";
import { Player } from "@/components/builds/Player";

/*
 * Prévia de um build de navegador. Custo na Vercel por partida: esta
 * renderização (uma consulta ao Mongo, alguns KB de HTML). O jogo em si
 * vem do MinIO, direto para o navegador, dentro de um iframe de outra
 * origem: nenhum byte do jogo passa por aqui.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Prévia do jogo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = {
  params: Promise<{ buildId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlayPage({ params, searchParams }: Props) {
  const { buildId } = await params;
  const sp = await searchParams;
  if (!PUBLIC_ID_RE.test(buildId)) notFound();

  if (!storageConfigured()) {
    return (
      <Notice title="Prévia indisponível">
        O armazenamento de arquivos ainda não está configurado neste servidor, então não há builds para jogar.
      </Notice>
    );
  }

  let found: Awaited<ReturnType<typeof buildForPlay>> = null;
  let viewer: { _id: import("mongodb").ObjectId } | null = null;
  try {
    const session = await getSession();
    // Sem conta: entra e volta. Acontece igual para id existente ou não.
    if (!session) redirect(`/entrar?de=${encodeURIComponent(`/jogar/${buildId}`)}`);
    viewer = session.user;
    found = await buildForPlay(buildId);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[jogar]", err);
    return (
      <Notice title="Prévia fora do ar">
        Não conseguimos abrir este build agora. Tente de novo em instantes.
      </Notice>
    );
  }
  // De outra conta ou inexistente: a mesma resposta (não revela que existe).
  if (!found || !found.project || !canView(viewer, found.project)) notFound();
  const { build, project } = found;
  const draftHref = `/publicar?projeto=${build.projectId.toHexString()}`;

  if (build.status !== "pronto") {
    return (
      <Notice title={build.status === "enviando" ? "Este build ainda está subindo" : "Este build não chegou inteiro"}>
        {build.status === "enviando"
          ? "Termine o envio no rascunho; a prévia abre quando todos os arquivos chegarem."
          : "Exclua este build no rascunho e envie de novo."}{" "}
        <Link href={draftHref}>Voltar ao rascunho</Link>
      </Notice>
    );
  }

  const src = publicUrl(build.bucket, build.prefix + build.entry);
  const trackId = TRACKS.some((t) => t.id === project!.track) ? project!.track : "experimental";
  const track = trackById(trackId);
  const isolatedMode = sp.isolado === "1" && build.needsIsolation;

  return (
    <section className={`play-stage${track.on === "--paper" ? " on-field" : ""}`} style={trackStyle(trackId)} aria-label="Prévia do jogo">
      <div className="wrap">
        <Player
          src={src}
          origin={s3Config().endpoint.origin}
          title={project!.title || "Jogo sem título"}
          engine={ENGINE_LABEL[build.engine as keyof typeof ENGINE_LABEL] ?? "HTML5"}
          version={build.engineVersion ?? null}
          fileCount={build.fileCount}
          totalSize={build.totalSize}
          width={build.width}
          height={build.height}
          needsIsolation={build.needsIsolation}
          isolatedMode={isolatedMode}
          heavy={build.totalSize >= HEAVY_BUILD_BYTES}
          draftHref={draftHref}
          buildId={buildId}
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
