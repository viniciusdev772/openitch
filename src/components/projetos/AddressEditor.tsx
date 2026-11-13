"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { changeAddress, type AddressResult } from "@/lib/projects/actions";
import { LIMITS, suggestSlug } from "@/lib/projects/limits";

/**
 * O endereço público de um jogo já publicado, com a troca no próprio lugar.
 * O endereço antigo continua levando ao novo.
 */
export function AddressEditor({
  draftId,
  slug: initial,
  onChange,
}: {
  draftId: string;
  slug: string;
  onChange?: (slug: string) => void;
}) {
  const id = useId();
  const [slug, setSlug] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);

  const preview = suggestSlug(value);

  const save = () => {
    if (pending) return;
    const fd = new FormData();
    fd.set("id", draftId);
    fd.set("endereco", value);
    setError(null);
    startTransition(async () => {
      let res: AddressResult;
      try {
        res = await changeAddress(fd);
      } catch {
        res = { ok: false, error: "Sem conexão com o servidor. O endereço não mudou." };
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const old = slug;
      setSlug(res.slug);
      setValue(res.slug);
      onChange?.(res.slug);
      setEditing(false);
      setNotice(res.slug === old ? null : `Endereço trocado. Quem abrir /jogo/${old} chega aqui.`);
    });
  };

  if (!editing) {
    return (
      <p className="field-hint" id={`${id}-v`}>
        Endereço no programa: <span className="pj-slug">/jogo/{slug}</span>.{" "}
        <button type="button" className="bo-link pj-inline" onClick={() => (setNotice(null), setEditing(true))}>
          Mudar endereço
        </button>
        {notice ? <span role="status"> {notice}</span> : null}
      </p>
    );
  }

  return (
    <div className="pj-address" role="group" aria-labelledby={`${id}-l`}>
      <label className="field-label" id={`${id}-l`} htmlFor={`${id}-i`}>
        Novo endereço
      </label>
      <div className="pj-address-row">
        <span className="pj-address-pre" aria-hidden>
          /jogo/
        </span>
        <input
          ref={field}
          id={`${id}-i`}
          className="input"
          value={value}
          maxLength={LIMITS.slug + 8}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-h${error ? ` ${id}-e` : ""}`}
        />
      </div>
      {error ? (
        <p className="field-error" id={`${id}-e`} role="alert">
          {error}
        </p>
      ) : null}
      <p className="field-hint" id={`${id}-h`}>
        Fica assim: <span className="pj-slug">/jogo/{preview || "…"}</span>. Minúsculas sem acento, palavras com hífen. O endereço
        antigo continua levando ao novo.
      </p>
      <div className="pj-address-act">
        <button type="button" className="btn btn--sm" onClick={save} aria-disabled={pending}>
          {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
          {pending ? "Salvando" : "Salvar endereço"}
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => (setValue(slug), setError(null), setEditing(false))}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
