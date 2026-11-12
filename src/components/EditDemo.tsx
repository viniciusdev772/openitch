"use client";

import { useId, useState } from "react";
import { gameBySlug } from "@/data/catalog";
import { Entry, trackStyle } from "./bits";

/** Proof beside "a page that is yours": the form edits the entry it previews. */
export function EditDemo() {
  const base = gameBySlug("carta-para-ninguem")!;
  const [title, setTitle] = useState(base.title);
  const [tagline, setTagline] = useState(base.tagline);
  const id = useId();
  return (
    <div className="edit-demo">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="field-label" htmlFor={`${id}-t`}>
            Título
          </label>
          <input id={`${id}-t`} className="input" value={title} maxLength={32} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${id}-g`}>
            Frase de apresentação
          </label>
          <textarea
            id={`${id}-g`}
            className="textarea"
            style={{ minHeight: 96 }}
            value={tagline}
            maxLength={90}
            onChange={(e) => setTagline(e.target.value)}
          />
          <p className="field-hint">Escreva aqui. A entrada ao lado muda junto.</p>
        </div>
      </div>
      <div className="sheet" style={trackStyle(base.track)} aria-live="polite">
        <Entry game={{ ...base, title: title || "Sem título", tagline: tagline || "…" }} link={false} />
      </div>
    </div>
  );
}
