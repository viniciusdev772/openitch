"use client";

import { useId, useState } from "react";

type Kind = "free" | "fixed" | "pwyw";

/** Proof beside the "your price" claim: the actual pricing control. */
export function PriceDemo() {
  const [kind, setKind] = useState<Kind>("pwyw");
  const [amount, setAmount] = useState("8");
  const id = useId();
  const n = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const pretty = n.toFixed(2).replace(".", ",");

  const headline = kind === "free" ? "Grátis" : kind === "fixed" ? `R$ ${pretty}` : n > 0 ? `R$ ${pretty} ou mais` : "Pague o que quiser";
  const button = kind === "free" ? "Baixar" : kind === "fixed" ? `Comprar por R$ ${pretty}` : n > 0 ? `Pagar a partir de R$ ${pretty}` : "Baixar e pagar se quiser";

  return (
    <div className="price-demo">
      <div className="controls">
        <div>
          <span className="field-label" id={`${id}-k`}>Modelo de preço</span>
          <div className="seg" role="radiogroup" aria-labelledby={`${id}-k`}>
            {(
              [
                ["free", "Grátis"],
                ["fixed", "Fixo"],
                ["pwyw", "Pague o que quiser"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {kind !== "free" && (
          <div>
            <label className="field-label" htmlFor={`${id}-a`}>
              {kind === "fixed" ? "Preço" : "Mínimo (0 para livre)"}
            </label>
            <div className="money">
              <span aria-hidden>R$</span>
              <input
                id={`${id}-a`}
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))}
              />
            </div>
          </div>
        )}
      </div>
      <div className="preview" aria-live="polite">
        <span className="label">Como aparece para quem joga</span>
        <span className="big">{headline}</span>
        <span className="btn" style={{ alignSelf: "flex-start" }} aria-hidden>
          {button}
        </span>
        <span className="field-hint">É só o controle de preço: nenhuma cobrança acontece aqui.</span>
      </div>
    </div>
  );
}
