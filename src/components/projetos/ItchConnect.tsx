"use client";

import { useId, useState, useTransition } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { connectItch } from "@/lib/itch/actions";

/** Ligar a conta do itch.io com a chave da API (guardada cifrada no servidor). */
export function ItchConnect({ onDone }: { onDone: (username: string) => void }) {
  const id = useId();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("chave", key);
      try {
        const res = await connectItch(fd);
        if (!res.ok) return setError(res.error);
        setKey("");
        onDone(res.username);
      } catch {
        setError("Sem conexão com o servidor. Tente de novo.");
      }
    });

  return (
    <form
      className="itch-connect"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && key.trim()) go();
      }}
    >
      <p className="field-hint" id={`${id}-hint`}>
        Para trazer os arquivos e builds, ligue sua conta: gere uma chave em{" "}
        <a href="https://itch.io/user/settings/api-keys" target="_blank" rel="noopener noreferrer">
          itch.io/user/settings/api-keys
        </a>{" "}
        e cole aqui. Ela fica cifrada, só serve para ler os seus jogos e você pode desligar quando quiser. É também o que prova que o jogo é seu.
      </p>
      <div className="pj-import-row">
        <input
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Chave da API do itch.io"
          aria-label="Chave da API do itch.io"
          aria-describedby={error ? `${id}-hint ${id}-err` : `${id}-hint`}
          aria-invalid={error ? true : undefined}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className="btn" disabled={pending || !key.trim()}>
          {pending ? <LoaderCircle aria-hidden className="bo-spin" size={18} /> : <KeyRound aria-hidden size={18} />}
          {pending ? "Conferindo…" : "Ligar conta"}
        </button>
      </div>
      {error ? (
        <p className="bo-alert" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
