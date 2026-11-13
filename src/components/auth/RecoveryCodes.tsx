"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download } from "lucide-react";

/** Mostra os códigos de recuperação uma única vez, com copiar e baixar. */
export function RecoveryCodes({
  codes,
  email,
  continueHref,
  continueLabel,
}: {
  codes: string[];
  email: string;
  continueHref?: string;
  continueLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const checkId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const text = [
    "VibeGames · códigos de recuperação",
    `Conta: ${email}`,
    `Gerados em: ${new Date().toLocaleString("pt-BR")}`,
    "",
    "Cada código funciona uma vez. Use para entrar sem o app autenticador",
    `ou para criar uma senha nova em ${typeof window === "undefined" ? "" : window.location.host}/recuperar.`,
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, "0")}  ${c}`),
    "",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibegames-codigos-de-recuperacao.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bo-codes" aria-labelledby="codigos-titulo">
      <h2 id="codigos-titulo" ref={headingRef} tabIndex={-1}>
        Guarde seus códigos de recuperação
      </h2>
      <p>
        Sem e-mail de redefinição, estes dez códigos são o seu caminho de volta se esquecer a senha ou perder o celular.
        Eles aparecem só agora. Cada um funciona uma vez.
      </p>
      <ol className="bo-code-list">
        {codes.map((c, i) => (
          <li key={c}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className="bo-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copiados" : "Copiar todos"}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={download}>
          <Download aria-hidden />
          Baixar .txt
        </button>
        <span className="visually-hidden" role="status">
          {copied ? "Códigos copiados." : ""}
        </span>
      </div>
      {continueHref ? (
        <div className="bo-codes-foot">
          <div className="bo-check">
            <input type="checkbox" id={checkId} checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            <label htmlFor={checkId}>Guardei os códigos num lugar seguro</label>
          </div>
          {saved ? (
            <Link href={continueHref} className="btn">
              {continueLabel ?? "Continuar"}
            </Link>
          ) : (
            <span className="btn" aria-disabled="true">
              {continueLabel ?? "Continuar"}
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}
