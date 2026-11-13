"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, PencilLine } from "lucide-react";
import { deleteDraft, unpublishProject } from "@/lib/projects/actions";
import { useOwnership } from "./LibraryState";
import "@/styles/dono.css";

/**
 * Faixa de tinta que só o dono vê, no alto da página pública do jogo (ou do
 * perfil). O HTML da página é igual para todos; a faixa aparece depois que a
 * ilha da estante confirma que quem está vendo publicou o jogo.
 */
export function OwnerBar({ title, kind = "game" }: { title: string; kind?: "game" | "profile" }) {
  const own = useOwnership();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  if (kind === "profile") {
    if (!own.profile) return null;
    return (
      <aside className="owner-bar" aria-label="Ferramentas do dono">
        <div className="wrap">
          <p>
            <strong>Esta página é sua.</strong> Só você vê esta faixa.
          </p>
          <div className="owner-act">
            <Link href="/conta#perfil" className="btn btn--lime btn--sm">
              <PencilLine aria-hidden /> Editar perfil
            </Link>
            <Link href="/conta/projetos" className="btn btn--ghost btn--sm">
              Seus jogos
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  const id = own.project;
  if (!id) return null;
  const editHref = `/publicar?projeto=${id}`;

  const run = (action: (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>, next: string) => {
    if (pending) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("confirmar", "excluir");
    setError(null);
    startTransition(async () => {
      try {
        const res = await action(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(next);
      } catch {
        setError("Sem conexão com o servidor. Nada mudou: tente de novo em instantes.");
      }
    });
  };

  return (
    <aside className="owner-bar" aria-label="Ferramentas do dono" data-confirm={confirming || undefined}>
      <div className="wrap">
        {confirming ? (
          <>
            <p>
              <strong>Excluir “{title}” de vez?</strong> Sai do programa com todos os arquivos e a capa. Não dá para desfazer.
            </p>
            <div className="owner-act">
              <button type="button" className="btn btn--sm owner-danger" onClick={() => run(deleteDraft, "/conta/projetos")} aria-disabled={pending}>
                {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
                {pending ? "Excluindo" : "Excluir de vez"}
              </button>
              <button ref={keepRef} type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)} disabled={pending}>
                Manter
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>Este jogo é seu.</strong> Só você vê esta faixa.
            </p>
            <div className="owner-act">
              <Link href={editHref} className="btn btn--lime btn--sm">
                <PencilLine aria-hidden /> Editar
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => run(unpublishProject, editHref)}
                aria-disabled={pending}
              >
                {pending ? "Tirando do ar" : "Tirar do ar"}
              </button>
              <button type="button" className="btn btn--ghost btn--sm owner-ask" onClick={() => setConfirming(true)}>
                Excluir
              </button>
            </div>
          </>
        )}
        {error ? (
          <p className="owner-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
