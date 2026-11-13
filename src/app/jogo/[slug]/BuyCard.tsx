"use client";

import { useId, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import type { Price } from "@/data/catalog";

interface DL {
  file: string;
  size: string;
  code: string;
  name: string;
}

export function BuyCard({
  price,
  title,
  downloads,
  playable,
  save,
}: {
  price: Price;
  title: string;
  downloads: DL[];
  playable: boolean;
  /** Botão Guardar, resolvido no servidor (estado da estante de quem está dentro). */
  save?: ReactNode;
}) {
  const id = useId();
  const min = price.kind === "pwyw" ? price.minimum : 0;
  const [amount, setAmount] = useState(price.kind === "pwyw" ? String(Math.max(min, 10)) : "");
  const [done, setDone] = useState<string | null>(null);
  const n = Number(amount.replace(",", ".")) || 0;
  const below = price.kind === "pwyw" && n < min;

  const headline = price.kind === "free" ? "Grátis" : price.kind === "fixed" ? `R$ ${price.amount.toFixed(2).replace(".", ",")}` : "Você decide";

  const browserOnly = playable && downloads.length === 0;
  const act = () => {
    if (below) return;
    if (browserOnly && (price.kind === "free" || n === 0)) {
      const stage = document.getElementById("palco");
      stage?.scrollIntoView({ behavior: "smooth", block: "start" });
      const target = stage?.querySelector<HTMLElement>("canvas, [aria-disabled]");
      target?.focus({ preventScroll: true });
      setDone(
        stage?.querySelector("canvas")
          ? null
          : `A build de navegador de ${title} não acompanha esta demonstração. Na versão real, ela abriria no palco acima.`,
      );
      return;
    }
    setDone(
      price.kind === "free" || (price.kind === "pwyw" && n === 0)
        ? `Nesta demonstração os arquivos de ${title} não estão disponíveis. Na versão real, o download começaria agora.`
        : `Nenhuma cobrança foi feita: pagamentos ainda não estão conectados. Valor escolhido: R$ ${n.toFixed(2).replace(".", ",")}.`,
    );
  };

  return (
    <div className="buy-card">
      <span className="field-label" style={{ marginBottom: 0 }}>
        Preço
      </span>
      <span className="amount">{headline}</span>
      {price.kind === "pwyw" && (
        <div>
          <label className="field-label" htmlFor={`${id}-v`}>
            Quanto você quer pagar? {min > 0 ? `(mínimo R$ ${min})` : "(pode ser zero)"}
          </label>
          <div className="money">
            <span aria-hidden>R$</span>
            <input
              id={`${id}-v`}
              className="input"
              inputMode="decimal"
              value={amount}
              aria-invalid={below}
              aria-describedby={below ? `${id}-e` : undefined}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d,.]/g, ""));
                setDone(null);
              }}
            />
          </div>
          {below && (
            <p className="publish-error" id={`${id}-e`}>
              O mínimo definido por quem fez é R$ {min}. Aumente o valor para continuar.
            </p>
          )}
        </div>
      )}
      <button type="button" className="btn" onClick={act} disabled={below}>
        {browserOnly && (price.kind === "free" || n === 0)
          ? "Jogar agora"
          : price.kind === "free"
          ? "Baixar grátis"
          : price.kind === "fixed"
            ? "Comprar"
            : n > 0
              ? `Pagar R$ ${n.toFixed(2).replace(".", ",")}`
              : "Baixar sem pagar"}
      </button>
      {save}
      {done && (
        <p className="status" role="status">
          {done}
        </p>
      )}
      {downloads.length > 0 && (
        <ul className="downloads" aria-label="Arquivos">
          {downloads.map((d) => (
            <li key={d.file}>
              <span className="code" title={d.name} aria-hidden>
                {d.code}
              </span>
              <span>{d.file}</span>
              <small>{d.size}</small>
            </li>
          ))}
        </ul>
      )}
      {playable && downloads.length === 0 && <p className="note">Roda no navegador. Não há arquivos para baixar.</p>}
      <p className="note">
        <Download aria-hidden size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
        Demonstração: nada é cobrado e nenhum arquivo é transferido.
      </p>
    </div>
  );
}
