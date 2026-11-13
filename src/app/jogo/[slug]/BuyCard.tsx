import Link from "next/link";
import type { ReactNode } from "react";
import { Download, Play } from "lucide-react";
import type { Price } from "@/data/base";

interface DL {
  file: string;
  size: string;
  /** Link de download (redireciona para o armazenamento), ou null se o arquivo não está no ar. */
  href: string | null;
  code: string;
  name: string;
}

const reais = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/**
 * O cartão de obter o jogo: o preço, o botão de jogar (build de navegador) e
 * um link por arquivo. Só jogos grátis entram no programa enquanto os
 * pagamentos não existem; um preço que ainda apareça aqui não libera arquivo.
 */
export function BuyCard({
  price,
  title,
  downloads,
  play,
  save,
}: {
  price: Price;
  title: string;
  downloads: DL[];
  /** Página de jogar no navegador, quando há build. */
  play: string | null;
  /** Botão Guardar (ilha de cliente: o estado da estante chega depois do HTML). */
  save?: ReactNode;
}) {
  const free = price.kind === "free";
  const headline = free ? "Grátis" : price.kind === "fixed" ? reais(price.amount) : "Você decide";
  const files = free ? downloads.filter((d) => d.href) : [];

  return (
    <div className="buy-card">
      <span className="field-label" style={{ marginBottom: 0 }}>
        Preço
      </span>
      <span className="amount">{headline}</span>
      {free && play && (
        <Link href={play} className="btn">
          <Play aria-hidden /> Jogar agora
        </Link>
      )}
      {save}
      {files.length > 0 && (
        <ul className="downloads" aria-label={`Arquivos de ${title}`}>
          {files.map((d) => (
            <li key={d.href}>
              <span className="code" title={d.name} aria-hidden>
                {d.code}
              </span>
              <a className="download-link" href={d.href!} rel="nofollow">
                <span>{d.file}</span>
                <span className="visually-hidden">, para {d.name}, {d.size}</span>
              </a>
              <small aria-hidden>{d.size}</small>
            </li>
          ))}
        </ul>
      )}
      {free ? (
        <p className="note">
          <Download aria-hidden size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
          {files.length > 0
            ? "Cada arquivo baixa direto do armazenamento do programa, sem conta e sem custo."
            : play
              ? "Roda no navegador. Não há arquivos para baixar."
              : "Os arquivos deste jogo estão sendo trocados. Volte em instantes."}
        </p>
      ) : (
        <p className="note">Pagamentos ainda não estão ligados: este jogo ainda não pode ser obtido por aqui.</p>
      )}
    </div>
  );
}
