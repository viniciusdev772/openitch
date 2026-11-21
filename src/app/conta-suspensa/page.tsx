import type { Metadata } from "next";
import Link from "next/link";
import { BoxBody, BoxHead, Notes } from "@/components/auth/BoxOffice";
import { readSuspended } from "@/lib/auth/session";
import { banDetails } from "@/lib/moderation/server";
import { readAppealAnswer, readCaseAnswer } from "@/lib/moderation/decide";
import { ruleById } from "@/lib/moderation/rules";
import { AppealForm } from "./AppealForm";

export const metadata: Metadata = { title: "Conta suspensa", robots: { index: false } };

const pct = (x: number | null | undefined) => `${Math.round((x ?? 0) * 100)}%`;
const day = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function ContaSuspensaPage() {
  const userId = await readSuspended();
  const info = userId ? await banDetails(userId) : null;

  if (!info) {
    return (
      <>
        <BoxHead title="Conta suspensa">
          <p>Para ver o aviso de uma conta suspensa, entre com ela de novo.</p>
        </BoxHead>
        <BoxBody>
          <p>
            <Link className="btn" href="/entrar">
              Entrar
            </Link>
          </p>
        </BoxBody>
      </>
    );
  }

  const { ban, decision, appeal } = info;
  const rule = ruleById(ban.rule);
  const votes = (decision?.votes ?? []).flatMap((v) => {
    const a = readCaseAnswer(v.model, v.answers);
    return a ? [a] : [];
  });
  const appealVotes = (appeal?.votes ?? []).flatMap((v) => {
    const p = readAppealAnswer(v.answers);
    return p === null ? [] : [{ model: v.model, keep: p }];
  });

  return (
    <>
      <BoxHead title={ban.revokedAt ? "Conta reaberta" : "Sua conta foi suspensa"}>
        <p>
          {ban.revokedAt
            ? "O recurso foi aceito. Você já pode entrar de novo."
            : `Em ${day(ban.at)}, a análise automática do Portal dos Games concluiu que conteúdo desta conta quebrou uma regra da comunidade.`}
        </p>
      </BoxHead>
      <BoxBody
        notes={
          <Notes
            title="Como funciona"
            items={[
              ["Quem decide", "Três modelos de decisão de fabricantes diferentes leem o mesmo conteúdo e votam. Vale a maioria."],
              ["O que acontece", "Os jogos que estavam no ar saem do programa e todas as sessões da conta são encerradas."],
              ["Recurso", "Um por decisão. Os modelos julgam o caso do zero, com o que você escrever."],
              ["Regras", <Link key="r" href="/termos#regras">Leia as regras da comunidade</Link>],
            ]}
          />
        }
      >
        <div className="bo-sheet">
          <h2 className="field-label">Regra</h2>
          <p>
            <strong>{rule?.title ?? ban.rule}.</strong> {rule?.text}
          </p>
          {votes.length > 0 ? (
            <>
              <h2 className="field-label">Votos</h2>
              <ul>
                {votes.map((v) => (
                  <li key={v.model}>
                    <code>{v.model}</code>: violação {pct(v.violation)}, gravidade {v.severity.toFixed(1)} de 3
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {ban.appeal ? (
            <>
              <h2 className="field-label">Recurso de {day(ban.appeal.at)}</h2>
              <p>{ban.appeal.upheld ? "A decisão foi mantida." : "A decisão foi revertida e a conta reaberta."}</p>
              {appealVotes.length > 0 ? (
                <ul>
                  {appealVotes.map((v) => (
                    <li key={v.model}>
                      <code>{v.model}</code>: manter {pct(v.keep)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
        {ban.revokedAt ? (
          <p>
            <Link className="btn" href="/entrar">
              Entrar
            </Link>
          </p>
        ) : !ban.appeal ? (
          <AppealForm />
        ) : null}
      </BoxBody>
    </>
  );
}
