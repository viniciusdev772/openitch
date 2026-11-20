"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { disconnectItch, importFromItch, importItchGame, itchAccount, type ImportResult, type ItchAccount } from "@/lib/itch/actions";
import { ItchConnect } from "./ItchConnect";

/**
 * Trazer da itch.io. Com a conta ligada (chave da API): a lista dos seus jogos,
 * um clique por jogo, e os arquivos vêm depois no passo 3. Sem a conta: pelo
 * endereço da página, só texto, capa e imagens.
 */
export function ImportItch() {
  const id = useId();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<ItchAccount | null>(null);
  const [which, setWhich] = useState<number | "url" | null>(null);
  const [pending, start] = useTransition();

  const loadAccount = () => itchAccount().then(setAccount, () => setAccount({ ok: false, error: "Sem conexão com o servidor." }));
  useEffect(() => {
    void loadAccount();
  }, []);

  const open = (res: ImportResult) => {
    if (!res.ok) return setError(res.error);
    const flag = res.existing
      ? "ja"
      : [res.reviewPrice && "preco", res.noCover && "semcapa", res.verified && "seu"].filter(Boolean).join(",") || "ok";
    router.push(`/publicar?projeto=${res.id}&itch=${flag}`);
  };

  const run = (target: number | "url", fn: () => Promise<ImportResult>) =>
    start(async () => {
      setError(null);
      setWhich(target);
      try {
        open(await fn());
      } catch {
        setError("Sem conexão com o servidor. Tente de novo.");
      }
    });

  const byUrl = () => {
    const fd = new FormData();
    fd.set("itch", url);
    run("url", () => importFromItch(fd));
  };

  return (
    <section className="wrap pj-import" aria-labelledby={`${id}-h`}>
      <div className="bo-sheet">
        <div>
          <h2 id={`${id}-h`} className="field-label">
            Trazer da itch.io
          </h2>
          <p className="field-hint">
            Já publicou no itch? Traga o jogo com título, descrição, plataformas, preço, etiquetas, capa, imagens, créditos e, com a conta
            ligada, os arquivos e a versão de navegador. Traga só jogos que são seus.
          </p>
        </div>

        {account?.ok && account.connected ? (
          <div className="itch-account">
            <p className="itch-who">
              Conta do itch.io ligada: <strong>{account.username}</strong>{" "}
              <button
                type="button"
                className="linklike"
                onClick={async () => {
                  await disconnectItch().catch(() => undefined);
                  void loadAccount();
                }}
              >
                Desligar
              </button>
            </p>
            {account.games.length === 0 ? (
              <p className="field-hint">Essa conta ainda não tem jogos no itch.io.</p>
            ) : (
              <ul className="itch-games">
                {account.games.map((g) => (
                  <li key={g.id} className="itch-game">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" loading="lazy" width={63} height={50} />
                    ) : (
                      <span className="itch-game-ph" aria-hidden />
                    )}
                    <span className="itch-game-text">
                      <span className="itch-name">{g.title}</span>
                      {g.shortText ? <span className="itch-meta">{g.shortText}</span> : null}
                    </span>
                    {g.imported ? (
                      <a className="btn btn--sm btn--ghost" href={`/publicar?projeto=${g.imported}`}>
                        Abrir rascunho
                      </a>
                    ) : (
                      <button type="button" className="btn btn--sm" disabled={pending} onClick={() => run(g.id, () => importItchGame(g.id))}>
                        {pending && which === g.id ? <LoaderCircle aria-hidden className="bo-spin" size={16} /> : <ArrowRight aria-hidden size={16} />}
                        {pending && which === g.id ? "Trazendo…" : "Trazer"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : account?.ok ? (
          <ItchConnect onDone={() => void loadAccount()} />
        ) : account && !account.ok ? (
          <p className="bo-alert" role="alert">
            {account.error}
          </p>
        ) : null}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending && url.trim()) byUrl();
          }}
        >
          <p className="field-hint" id={`${id}-hint`}>
            Ou cole o endereço da página do jogo (sem a conta ligada, os arquivos ficam por sua conta):
          </p>
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
              {pending && which === "url" ? <LoaderCircle aria-hidden className="bo-spin" size={18} /> : <ArrowRight aria-hidden size={18} />}
              {pending && which === "url" ? "Trazendo…" : "Trazer"}
            </button>
          </div>
        </form>
        {error ? (
          <p className="bo-alert" id={`${id}-err`} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
