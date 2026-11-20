"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { removeScreenshot } from "@/lib/projects/cover";

/** Capturas de tela do jogo (vindas do itch.io): aparecem na página dele, em "Imagens". */
export function Screenshots({ draftId, initial }: { draftId: string; initial: { key: string; url: string }[] }) {
  const [shots, setShots] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!shots.length) return <p className="field-hint">Sem imagens.</p>;
  return (
    <div className="stack">
      <p className="field-hint">Aparecem na página do jogo, em Imagens, nesta ordem.</p>
      <ul className="pj-shots">
        {shots.map((s, i) => (
          <li key={s.key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt={`Imagem ${i + 1}`} loading="lazy" />
            <button
              type="button"
              className="pj-shot-x"
              aria-label={`Tirar a imagem ${i + 1}`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const fd = new FormData();
                  fd.set("id", draftId);
                  fd.set("chave", s.key);
                  const res = await removeScreenshot(fd).catch(() => ({ ok: false as const, error: "Sem conexão com o servidor." }));
                  if (!res.ok) return setError(res.error);
                  setShots((cur) => cur.filter((x) => x.key !== s.key));
                })
              }
            >
              <X aria-hidden size={16} />
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="bo-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
