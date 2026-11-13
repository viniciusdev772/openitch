"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDay, formatTime } from "@/data/catalog";
import { SAMPLE_NOW, jamState, splitDuration } from "./clock";
import { useJamNow } from "./useJamNow";

const pad = (n: number) => String(n).padStart(2, "0");
const when = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

function spoken(d: number, h: number, m: number) {
  const parts = [];
  if (d) parts.push(`${d} ${d === 1 ? "dia" : "dias"}`);
  if (d || h) parts.push(`${h} ${h === 1 ? "hora" : "horas"}`);
  parts.push(`${m} ${m === 1 ? "minuto" : "minutos"}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0];
}

/**
 * State line, countdown and send action for one jam. The count only runs in the
 * browser; the server prints the fixed date instead. Only the live state glows.
 */
export function JamClock({ slug, start, end }: { slug: string; start: string; end: string }) {
  const { now, reduced } = useJamNow();
  const state = jamState({ start, end }, now ?? SAMPLE_NOW);
  const target = state === "next" ? start : state === "live" ? end : null;

  let count: React.ReactNode = null;
  if (target) {
    if (now === null) {
      count = (
        <p className="jam-count jam-count--static">
          <time dateTime={target}>{when(target)}</time>
        </p>
      );
    } else {
      const { d, h, m, s } = splitDuration(new Date(target).getTime() - now);
      const units: [string, string][] = [];
      if (d) units.push([String(d), d === 1 ? "dia" : "dias"]);
      units.push([pad(h), "h"], [pad(m), "min"]);
      if (!reduced) units.push([pad(s), "s"]);
      count = (
        <p className="jam-count" role="timer" aria-label={`${state === "live" ? "Termina em" : "Começa em"} ${spoken(d, h, m)}`}>
          {units.map(([v, u]) => (
            <span key={u}>
              <b>{v}</b>
              <small>{u}</small>
            </span>
          ))}
        </p>
      );
    }
  }

  return (
    <div className="jam-clock" data-state={state}>
      <p className="jam-state">
        {state === "live" ? (
          <span className="jam-live">Ao vivo agora</span>
        ) : state === "next" ? (
          "Começa em"
        ) : (
          "Encerrada"
        )}
      </p>
      {state === "live" && <p className="jam-clock-lead">Termina em</p>}
      {count}
      {state === "past" && (
        <p className="jam-count jam-count--static">
          <time dateTime={end}>{when(end)}</time>
        </p>
      )}
      <div className="jam-clock-act">
        {state === "past" ? (
          <>
            <p>Os envios fecharam no prazo. As entradas estão no fim da página.</p>
            <a className="btn btn--ghost" href="#entradas">
              Ver as entradas
            </a>
          </>
        ) : (
          <>
            <Link className="btn" href={`/publicar?jam=${encodeURIComponent(slug)}`}>
              Enviar um jogo <ArrowRight aria-hidden />
            </Link>
            <p>
              {state === "live"
                ? `Vale o que for publicado até ${when(end)}.`
                : `Os envios contam a partir de ${when(start)}.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Empty entries state; its copy follows the same client clock as the status sheet. */
export function JamEntriesEmpty({
  slug,
  start,
  end,
  submitted,
}: {
  slug: string;
  start: string;
  end: string;
  submitted: number;
}) {
  const { now } = useJamNow();
  const state = jamState({ start, end }, now ?? SAMPLE_NOW);
  const title =
    state === "next" ? "A jam ainda não abriu" : state === "live" ? "As entradas chegam no prazo" : "Nenhuma entrada nesta amostra";
  const text =
    state === "next"
      ? `Abre em ${when(start)}. Quando o prazo zerar, os jogos enviados entram aqui todos de uma vez.`
      : state === "live"
        ? `${submitted > 0 ? `${submitted} ${submitted === 1 ? "jogo enviado" : "jogos enviados"} até agora. ` : ""}Eles entram no programa juntos quando o prazo zerar, em ${when(end)}.`
        : "Os jogos desta jam não fazem parte desta edição de demonstração.";
  return (
    <div className="empty jam-empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {state !== "past" && (
        <Link className="btn" href={`/publicar?jam=${encodeURIComponent(slug)}`}>
          Enviar um jogo <ArrowRight aria-hidden />
        </Link>
      )}
    </div>
  );
}
