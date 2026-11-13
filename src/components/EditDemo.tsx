"use client";

import { useId, useState } from "react";
import type { Game } from "@/data/base";
import { Entry, trackStyle } from "./bits-base";

/** Proof beside "a page that is yours": the form edits the entry it previews. */
/** A entrada em branco que o formulário de publicar também começa: nada publicado, só a prévia. */
const BLANK: Game = {
  slug: "seu-jogo",
  number: 1,
  title: "Seu jogo",
  tagline: "Uma frase que diz do que se trata.",
  description: [],
  creator: "",
  track: "narrativo",
  tags: [],
  platforms: ["web"],
  price: { kind: "free" },
  published: "2026-01-01T00:00:00-03:00",
  updated: "2026-01-01T00:00:00-03:00",
  session: "",
  languages: ["Português"],
  cover: "letters",
  palette: ["--magenta", "--ink", "--paper"],
  downloads: [],
};

export function EditDemo() {
  const base = BLANK;
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
        <Entry game={{ ...base, title: title || "Sem título", tagline: tagline || "…" }} link={false} creatorName="Você" />
      </div>
    </div>
  );
}
