"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { importFromItch } from "@/lib/itch/actions";

/** Trazer um jogo da itch.io: cola o endereço, ganha um rascunho e abre o editor. */
export function ImportItch() {
  const id = useId();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("itch", url);
      let res;
      try {
        res = await importFromItch(fd);
      } catch {
        return setError("Sem conexão com o servidor. Tente de novo.");
      }
      if (!res.ok) return setError(res.error);
      const flag = res.existing ? "ja" : [res.reviewPrice && "preco", res.noCover && "semcapa"].filter(Boolean).join(",") || "ok";
      router.push(`/publicar?projeto=${res.id}&itch=${flag}`);
    });

  return (
    <section className="wrap pj-import" aria-labelledby={`${id}-h`}>
      <form
        className="bo-sheet"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) go();
        }}
      >
        <div>
          <h2 id={`${id}-h`} className="field-label">
            Trazer da itch.io
          </h2>
          <p className="field-hint" id={`${id}-hint`}>
            Cole o endereço da página do jogo e criamos um rascunho com título, descrição, plataformas, preço, etiquetas e capa. Os arquivos
            você envia aqui depois. Traga só jogos que são seus.
          </p>
        </div>
        <div className="pj-import-row">
          <input
            className="input"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://seunome.itch.io/seu-jogo"
            aria-label="Endereço do jogo no itch.io"
            aria-describedby={error ? `${id}-hint ${id}-err` : `${id}-hint`}
            aria-invalid={error ? true : undefined}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={300}
          />
          <button type="submit" className="btn" disabled={pending || !url.trim()}>
            {pending ? <LoaderCircle aria-hidden className="bo-spin" size={18} /> : <ArrowRight aria-hidden size={18} />}
            {pending ? "Trazendo…" : "Trazer"}
          </button>
        </div>
        {error ? (
          <p className="bo-alert" id={`${id}-err`} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
