import type { Metadata } from "next";
import Link from "next/link";
import { BoxBody, BoxHead, Notes } from "@/components/auth/BoxOffice";
import { Reasoning } from "@/components/Reasoning";
import { readSuspended } from "@/lib/auth/session";
import { banDetails } from "@/lib/moderation/server";
import { judgeName, readAppealAnswer, readCaseAnswer } from "@/lib/moderation/decide";
import { ruleById } from "@/lib/moderation/rules";
import { AppealForm } from "./AppealForm";

export const metadata: Metadata = { title: "Conta suspensa", robots: { index: false } };

const pct = (x: number | null | undefined) => `${Math.round((x ?? 0) * 100)}%`;
const day = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
const bench = (stage: string | undefined, n: number) =>
  stage === "plenario" ? `Plenário, ${n} juízes` : stage === "turma" ? `Turma, ${n} juízes` : `${n} juízes`;

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
            ? "O recurso foi aceito pelo plenário. Você já pode entrar de novo."
            : `Em ${day(ban.at)}, o tribunal de moderação do Portal dos Games concluiu que conteúdo desta conta quebrou uma regra da comunidade.`}
        </p>
      </BoxHead>
      <BoxBody
        notes={
          <Notes
            title="Como funciona"
            items={[
              ["Quem decide", "Modelos de decisão de cinco empresas diferentes. Fechar uma conta exige o plenário, com 4 de 5 votos."],
              ["O que acontece", "Os jogos que estavam no ar saem do programa e todas as sessões da conta são encerradas."],
              ["Recurso", "Um por decisão, julgado do zero pelo plenário. A conta só continua fechada com 4 de 5 votos para manter."],
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
          <Reasoning text={decision?.reasoning} />
          {decision ? (
            <p>
              <a href={`/api/moderacao/decisao/${decision._id.toHexString()}`} target="_blank" rel="noopener">
                Baixar a decisão em PDF
              </a>
            </p>
          ) : null}
          {votes.length > 0 ? (
            <>
              <h2 className="field-label">Votos ({bench(decision?.stage, votes.length)})</h2>
              <ul>
                {votes.map((v) => (
                  <li key={v.model}>
                    {judgeName(v.model)}: violação {pct(v.violation)}, gravidade {v.severity.toFixed(1)} de 3
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {ban.appeal ? (
            <>
              <h2 className="field-label">Recurso de {day(ban.appeal.at)}</h2>
              <p>{ban.appeal.upheld ? "A decisão foi mantida." : "A decisão foi revertida e a conta reaberta."}</p>
              <Reasoning text={appeal?.reasoning} />
              {appeal ? (
                <p>
                  <a href={`/api/moderacao/decisao/${appeal._id.toHexString()}`} target="_blank" rel="noopener">
                    Baixar a decisão do recurso em PDF
                  </a>
                </p>
              ) : null}
              {appealVotes.length > 0 ? (
                <ul>
                  {appealVotes.map((v) => (
                    <li key={v.model}>
                      {judgeName(v.model)}: manter {pct(v.keep)}
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
