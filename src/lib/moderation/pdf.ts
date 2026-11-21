import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ModerationDoc } from "@/lib/auth/db";
import { judgeName, readAppealAnswer, readCaseAnswer } from "./decide";
import { ruleById } from "./rules";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const OUTCOME: Record<ModerationDoc["outcome"], string> = {
  arquivada: "Arquivada: nenhuma regra foi quebrada de forma clara.",
  removido: "O jogo foi tirado do ar (ou o texto do perfil foi apagado).",
  banido: "A conta foi fechada.",
  mantido: "Recurso negado: a decisão anterior foi mantida.",
  revertido: "Recurso aceito: a decisão anterior foi desfeita.",
};

/** Os dados do PDF a partir de uma decisão guardada. `target` diz o que foi julgado ('Jogo "X"'). */
export function pdfDataOf(
  d: Pick<ModerationDoc, "_id" | "at" | "kind" | "stage" | "rule" | "outcome" | "reasoning" | "votes" | "mitigated"> & { targetKey?: string },
  target: string,
  /** Nas decisões de recurso: o texto que a pessoa escreveu. */
  appealText?: string,
): DecisionPdfData {
  const r = d.rule ? ruleById(d.rule) : undefined;
  const appeal = d.kind === "recurso";
  const votes = d.votes.flatMap((v) => {
    if (appeal) {
      const p = readAppealAnswer(v.answers);
      return p === null ? [] : [{ judge: judgeName(v.model), vote: `manter a decisão: ${pct(p)}` }];
    }
    const a = readCaseAnswer(v.model, v.answers);
    if (!a) return [];
    const saw = a.violation >= 0.5 && a.rule !== "nenhuma";
    // A regra só aparece quando o juiz viu outra, diferente da decidida (ou nenhuma).
    const other = !saw ? " · nenhuma regra" : a.rule !== d.rule ? ` · ${ruleById(a.rule)?.title ?? a.rule}` : "";
    return [{ judge: judgeName(v.model), vote: `violação ${pct(a.violation)} · gravidade ${a.severity.toFixed(1).replace(".", ",")} de 3${other}` }];
  });
  const comment = d.targetKey?.startsWith("comentario:") ?? false;
  const outcome =
    (comment && d.outcome === "removido" ? "O comentário foi tirado da página." : OUTCOME[d.outcome]) +
    (d.mitigated ? " O plenário pediu o fechamento da conta, mas sem a maioria qualificada; ficou a pena menor." : "");
  const next =
    d.outcome === "removido" && comment
      ? "Você pode recorrer uma vez, no próprio comentário, na página do jogo (só você o vê enquanto estiver removido)."
      : d.outcome === "removido"
      ? "Você pode recorrer uma vez, em Seus jogos (/conta/projetos), ou mudar o que quebra a regra e publicar de novo, o que passa por uma nova análise."
      : d.outcome === "banido"
        ? "Você pode recorrer uma vez, na página que aparece ao tentar entrar. A conta só continua fechada se 4 de 5 juízes votarem para manter."
        : appeal
          ? "Esta foi a decisão do recurso. Não cabe outro recurso sobre a mesma decisão."
          : "Nada mudou no conteúdo. Uma denúncia nova, com outro motivo ou sobre um conteúdo alterado, é julgada de novo.";
  return {
    id: d._id.toHexString().slice(-8).toUpperCase(),
    at: d.at,
    kind: appeal ? "Recurso" : d.kind === "publicacao" ? "Triagem da publicação" : "Denúncia",
    bench: d.stage === "plenario" ? `Plenário, ${votes.length} juízes` : `Turma, ${votes.length} juízes`,
    target,
    rule: r ? { title: r.title, text: r.text } : null,
    outcome,
    reasoning: d.reasoning ?? null,
    votes,
    appeal: appeal && appealText ? [appealText] : undefined,
    next,
  };
}

/*
 * A decisão do tribunal em PDF: o "acórdão" que a pessoa dona do conteúdo
 * baixa para guardar ou mostrar. O texto vem do próprio tribunal (votos dos
 * juízes e a fundamentação do relator); aqui só se diagrama. Sem banco nem
 * rede: recebe os dados prontos e o logotipo (public/marca/logo.png).
 */

export interface DecisionPdfData {
  id: string;
  at: Date;
  /** "Denúncia", "Triagem da publicação" ou "Recurso". */
  kind: string;
  /** "Turma, 3 juízes" ou "Plenário, 5 juízes". */
  bench: string;
  /** O que foi julgado, ex.: 'Jogo "Lantern Rock"'. */
  target: string;
  rule: { title: string; text: string } | null;
  /** O resultado em uma frase. */
  outcome: string;
  reasoning: string | null;
  votes: { judge: string; vote: string }[];
  /** Texto do recurso, como a pessoa escreveu (só nas decisões de recurso). */
  appeal?: string[];
  /** O que a pessoa ainda pode fazer. */
  next: string;
}

const A4: [number, number] = [595.28, 841.89];
const M = 56;
const INK = rgb(0x12 / 255, 0x13 / 255, 0x1b / 255);
const MUTE = rgb(0x56 / 255, 0x5b / 255, 0x69 / 255);
const ULTRA = rgb(0x2b / 255, 0x2f / 255, 0xe3 / 255);
const LIME = rgb(0xc8 / 255, 0xf0 / 255, 0x3c / 255);

/** As fontes padrão do PDF só têm o Latin-1 do Windows (cp1252): o resto vira equivalente ou sai. */
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function safeText(s: string): string {
  return s
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[   ]/g, " ")
    .replace(/‑/g, "-")
    .split("")
    .filter((ch) => ch === "\n" || (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 256) || CP1252_EXTRA.has(ch))
    .join("");
}

/** Quebra o texto em linhas que cabem em `width`. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safeText(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function decisionPdf(d: DecisionPdfData, logoPng: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safeText(`Decisão ${d.id} · Portal dos Games`));
  doc.setAuthor("Tribunal de moderação do Portal dos Games");
  doc.setSubject(safeText(`${d.kind}: ${d.target}`));
  doc.setCreator("Portal dos Games");
  doc.setProducer("Portal dos Games (pdf-lib)");
  doc.setCreationDate(d.at);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = logoPng ? await doc.embedPng(logoPng).catch(() => null) : null;
  const width = A4[0] - 2 * M;

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1];

  // Cabeçalho: faixa ultramar com o logotipo (o fundo do logotipo é o mesmo azul).
  const band = 100;
  page.drawRectangle({ x: 0, y: A4[1] - band, width: A4[0], height: band, color: ULTRA });
  if (logo) {
    const h = band;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M - w * 0.09, y: A4[1] - band, width: w, height: h });
  } else {
    page.drawText("portal dos games", { x: M, y: A4[1] - band / 2 - 10, size: 28, font: bold, color: LIME });
  }
  y = A4[1] - band - 32;

  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - M;
  };
  const need = (h: number) => {
    if (y - h < M + 28) newPage();
  };
  const lines = (text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    const lead = size * 1.45;
    for (const l of wrap(text, font, size, width - (opts.indent ?? 0))) {
      need(lead);
      page.drawText(l, { x: M + (opts.indent ?? 0), y, size, font, color: opts.color ?? INK });
      y -= lead;
    }
    y -= opts.gap ?? 0;
  };
  const heading = (text: string) => {
    need(40);
    y -= 5;
    page.drawLine({ start: { x: M, y: y + 14 }, end: { x: M + width, y: y + 14 }, thickness: 1.5, color: INK });
    lines(text.toUpperCase(), { font: bold, size: 9, color: INK, gap: 4 });
  };

  // O título grande sobe acima da própria linha de base: o respiro fica antes dele.
  lines("Tribunal de moderação", { font: bold, size: 10, color: ULTRA, gap: 16 });
  lines(`Decisão nº ${d.id}`, { font: bold, size: 24, gap: 6 });
  lines(d.outcome, { font: bold, size: 13, gap: 14 });

  // Ficha do caso: rótulo e valor em duas colunas.
  const field = (label: string, value: string) => {
    const lw = 128;
    const vl = wrap(value, regular, 10.5, width - lw);
    need(vl.length * 15 + 4);
    page.drawText(safeText(label), { x: M, y, size: 9, font: bold, color: MUTE });
    for (const l of vl) {
      page.drawText(l, { x: M + lw, y, size: 10.5, font: regular, color: INK });
      y -= 15;
    }
    y -= 3;
  };
  field("Data", d.at.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }));
  field("Procedimento", d.kind);
  field("Formação", d.bench);
  field("Conteúdo julgado", d.target);
  field("Regra", d.rule ? d.rule.title : "Nenhuma regra quebrada");

  if (d.rule) {
    heading("A regra");
    lines(d.rule.text, { gap: 4 });
  }

  heading("Fundamentação");
  lines(d.reasoning ?? "Arquivamento: os juízes não viram uma quebra clara de regra, e nenhuma fundamentação escrita é feita nesse caso.", {
    gap: 2,
  });
  if (d.reasoning) lines("Escrita pelo relator, um modelo de IA, depois do voto dos juízes.", { size: 8.5, color: MUTE, gap: 4 });

  if (d.appeal?.length) {
    heading("O recurso");
    for (const a of d.appeal) lines(a, { gap: 2 });
  }

  heading("Votos");
  for (const v of d.votes) {
    need(16);
    page.drawText(safeText(v.judge), { x: M, y, size: 10, font: bold, color: INK });
    lines(v.vote, { size: 10, indent: 175, gap: 1 });
  }

  heading("E agora");
  lines(d.next);

  // Rodapé em todas as páginas.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 18 }, end: { x: A4[0] - M, y: M + 18 }, thickness: 0.5, color: MUTE });
    const note = safeText(
      `Decisão automatizada por modelos de IA, sem pessoa no meio (veja /termos). Gerado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    );
    p.drawText(note, { x: M, y: M + 4, size: 7.5, font: regular, color: MUTE });
    const num = `${i + 1} / ${pages.length}`;
    p.drawText(num, { x: A4[0] - M - regular.widthOfTextAtSize(num, 7.5), y: M + 4, size: 7.5, font: regular, color: MUTE });
  });

  return doc.save();
}
