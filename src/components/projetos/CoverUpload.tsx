"use client";

import { useId, useRef, useState } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { confirmCover, removeCover, signCover, type CoverResult } from "@/lib/projects/cover";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 4 * 1024 * 1024;
const OFFLINE = "Sem conexão com o servidor. A capa não mudou: tente de novo.";

/**
 * Imagem de capa: vai do navegador direto para o armazenamento e só entra na
 * página depois que o servidor confere. Sem imagem, vale a capa provisória.
 */
export function CoverUpload({
  draftId,
  url,
  onChange,
}: {
  draftId: string | null;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "enviando" | "tirando">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!draftId) {
    return <p className="field-hint">Salve o rascunho para enviar uma imagem de capa. Até lá vale a capa provisória.</p>;
  }

  const send = async (file: File) => {
    setError(null);
    setNotice(null);
    if (!TYPES.includes(file.type)) return setError("Use uma imagem PNG, JPEG ou WebP.");
    if (file.size > MAX) return setError("A imagem passou de 4 MB. Exporte menor (1200 × 960 px basta).");
    setBusy("enviando");
    try {
      const fd = new FormData();
      fd.set("id", draftId);
      fd.set("tipo", file.type);
      fd.set("tamanho", String(file.size));
      const signed: CoverResult = await signCover(fd);
      if (!signed.ok || !signed.upload || !signed.key) throw new Error(signed.ok ? OFFLINE : signed.error);
      const put = await fetch(signed.upload.url, { method: "PUT", headers: signed.upload.headers, body: file });
      if (!put.ok) throw new Error("O armazenamento recusou a imagem. Tente de novo.");
      const cf = new FormData();
      cf.set("id", draftId);
      cf.set("chave", signed.key);
      const done = await confirmCover(cf);
      if (!done.ok) throw new Error(done.error);
      onChange(done.url);
      setNotice("Capa trocada. Se o jogo está no programa, a página pública já mostra a nova.");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : OFFLINE);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const clear = async () => {
    setError(null);
    setNotice(null);
    setBusy("tirando");
    try {
      const fd = new FormData();
      fd.set("id", draftId);
      const res = await removeCover(fd);
      if (!res.ok) throw new Error(res.error);
      onChange(null);
      setNotice("Imagem tirada. A página volta para a capa provisória.");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : OFFLINE);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pj-cover">
      <div className="pj-cover-act">
        <label className="btn btn--sm btn--ghost pj-cover-pick" htmlFor={`${id}-f`} aria-disabled={busy !== null || undefined}>
          {busy === "enviando" ? <LoaderCircle aria-hidden className="bo-spin" /> : <ImageUp aria-hidden />}
          {busy === "enviando" ? "Enviando imagem" : url ? "Trocar imagem" : "Enviar imagem"}
        </label>
        <input
          ref={input}
          id={`${id}-f`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          disabled={busy !== null}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f);
          }}
          aria-describedby={`${id}-h`}
        />
        {url ? (
          <button type="button" className="bo-link" onClick={clear} disabled={busy !== null}>
            {busy === "tirando" ? "Tirando" : "Tirar imagem"}
          </button>
        ) : null}
      </div>
      <p className="field-hint" id={`${id}-h`}>
        PNG, JPEG ou WebP, até 4 MB, no formato 5:4 (1200 × 960 px, por exemplo). Ela entra no lugar da capa provisória em
        todo o programa.
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="field-hint pj-cover-ok" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
