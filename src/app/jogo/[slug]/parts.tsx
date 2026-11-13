import { Fragment } from "react";
import { formatDate, formatDay, type Game } from "@/data/catalog";
import { DEVLOGS } from "@/data/devlogs";

/*
 * Peças impressas da página do jogo (e reaproveitadas na do criador). Tudo
 * aqui roda no servidor e só lê o catálogo.
 */

export interface LogNote {
  date: string;
  title: string;
  body: string;
  /** Nota completa em /novidades, quando existe. */
  href?: string;
}

const sameDay = (a: string, b: string) => formatDate(a) === formatDate(b);

/**
 * Diário do jogo, mais recente primeiro: as notas que vêm com o jogo e as
 * notas publicadas em Novidades. Quando as duas falam do mesmo dia, viram
 * uma linha só, com o link para a nota completa.
 */
export function gameLog(game: Game): LogNote[] {
  const published = DEVLOGS.filter((d) => d.game === game.slug);
  const used = new Set<string>();
  const notes: LogNote[] = (game.devlog ?? []).map((p) => {
    const match = published.find((d) => !used.has(d.slug) && sameDay(d.at, p.date));
    if (match) used.add(match.slug);
    return { date: p.date, title: p.title, body: p.body, href: match ? `/novidades/${match.slug}` : undefined };
  });
  for (const d of published) {
    if (!used.has(d.slug)) notes.push({ date: d.at, title: d.title, body: d.body[0], href: `/novidades/${d.slug}` });
  }
  return notes.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/** "12 nov" como na coluna de datas da programação: o dia em numeral, o mês embaixo. */
export function DayNumeral({ iso }: { iso: string }) {
  // formatDay dá "12 de nov": fica o numeral e o mês, sem o "de".
  const parts = formatDay(iso).split(" ");
  const day = parts[0];
  const month = parts[parts.length - 1];
  return (
    <time className="day-no" dateTime={iso}>
      {day}
      <small>{month}</small>
    </time>
  );
}

/**
 * Uma linha de controle do catálogo ("Setas ou A/D: inclina o barco") vira a
 * legenda impressa: as teclas em caixinhas, a ação ao lado. Linha sem dois
 * pontos sai inteira como texto.
 */
export function Controls({ lines }: { lines: string[] }) {
  return (
    <ul className="game-controls">
      {lines.map((line) => {
        const at = line.indexOf(":");
        if (at < 0) {
          return (
            <li key={line}>
              <span className="game-controls-act game-controls-act--whole">{line}</span>
            </li>
          );
        }
        const keys = line
          .slice(0, at)
          .split(/,\s*|\s+ou\s+/)
          .map((k) => k.trim())
          .map((k) => k.charAt(0).toLocaleUpperCase("pt-BR") + k.slice(1))
          .filter(Boolean);
        return (
          <li key={line}>
            <span className="game-controls-keys">
              {keys.map((k, i) => (
                <Fragment key={k}>
                  {i > 0 && i === keys.length - 1 ? <span className="game-controls-or">ou</span> : null}
                  {i > 0 && i < keys.length - 1 ? <span className="visually-hidden">, </span> : null}
                  <kbd>{k}</kbd>
                </Fragment>
              ))}
            </span>
            <span className="game-controls-act">{line.slice(at + 1).trim()}</span>
          </li>
        );
      })}
    </ul>
  );
}
