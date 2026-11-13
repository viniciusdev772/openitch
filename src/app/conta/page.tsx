import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { BoxHead } from "@/components/auth/BoxOffice";
import { db, type SecurityEventType } from "@/lib/auth/db";
import { getSession, sessionIsIdle } from "@/lib/auth/session";
import { describeDevice } from "@/lib/auth/request";
import { revokeOtherSessions, revokeSession, signOut } from "@/lib/auth/actions";
import { DeleteAccountForm, DisableTotpForm, NameForm, PasswordForm, RecoveryCodesForm } from "./forms";

export const metadata: Metadata = { title: "Sua conta", robots: { index: false } };

const TZ = "America/Sao_Paulo";
const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });

function dayLabel(d: Date) {
  const key = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x);
  if (key(d) === key(new Date())) return "hoje";
  if (key(d) === key(new Date(Date.now() - 864e5))) return "ontem";
  return day.format(d).replace(".", "");
}

const EVENT_LABEL: Record<SecurityEventType, string> = {
  conta_criada: "Conta criada",
  entrada: "Entrada com senha",
  entrada_2fa: "Entrada com senha e código",
  senha_errada: "Tentativa com senha errada",
  "2fa_errado": "Código de duas etapas errado",
  saida: "Saída",
  senha_alterada: "Senha trocada",
  senha_redefinida: "Senha redefinida com código de recuperação",
  "2fa_ativado": "Verificação em duas etapas ligada",
  "2fa_desativado": "Verificação em duas etapas desligada",
  codigos_gerados: "Códigos de recuperação novos",
  codigo_recuperacao_usado: "Código de recuperação usado",
  sessao_encerrada: "Sessão encerrada",
  outras_sessoes_encerradas: "Outras sessões encerradas",
  nome_alterado: "Nome alterado",
};
const ALERT_EVENTS = new Set<SecurityEventType>(["senha_errada", "2fa_errado", "2fa_desativado"]);

export default async function ContaPage({ searchParams }: { searchParams: Promise<{ "2fa"?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar?de=/conta");
  const { user, publicId } = session;

  const { sessions, events } = await db();
  const [found, log] = await Promise.all([
    sessions
      .find({ userId: user._id, expiresAt: { $gt: new Date() } })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .toArray(),
    events.find({ userId: user._id }).sort({ at: -1 }).limit(25).toArray(),
  ]);
  // Sessões paradas além do limite já não entram: não aparecem como abertas.
  const active = found.filter((s) => !sessionIsIdle(s));
  const codesLeft = user.recoveryCodes.filter((c) => !c.usedAt).length;
  const others = active.filter((s) => s.publicId !== publicId).length;

  return (
    <>
      <BoxHead title="Sua conta">
        <p>
          <strong>{user.name}</strong>
          <br />
          {user.email} · no programa desde {full.format(user.createdAt)}
        </p>
      </BoxHead>

      <div className="wrap acc">
        <div className="acc-main">
          {sp["2fa"] === "ativada" ? (
            <p className="bo-ok" role="status">
              Verificação em duas etapas ligada. A partir da próxima entrada pedimos o código do app.
            </p>
          ) : null}

          <section className="acc-section" aria-labelledby="sessoes">
            <div className="acc-head">
              <h2 id="sessoes">Sessões abertas</h2>
              <span className="num acc-count">{String(active.length).padStart(2, "0")}</span>
            </div>
            <p className="acc-intro">Cada aparelho onde sua conta está aberta. Encerre o que você não reconhece.</p>
            <ol className="acc-sessions">
              {active.map((s) => {
                const current = s.publicId === publicId;
                return (
                  <li key={s.publicId} data-current={current || undefined}>
                    <span className="acc-time">
                      <b className="num">{time.format(s.lastSeenAt)}</b>
                      <small>{dayLabel(s.lastSeenAt)}</small>
                    </span>
                    <span className="acc-what">
                      <strong>{describeDevice(s.userAgent)}</strong>
                      <small>
                        {[s.place, s.ip].filter(Boolean).join(" · ")} · entrou {dayLabel(s.createdAt)} às{" "}
                        {time.format(s.createdAt)}
                        {s.mfa ? " · com código" : ""}
                        {s.persistent ? "" : " · até fechar o navegador"}
                      </small>
                    </span>
                    <span className="acc-act">
                      {current ? (
                        <span className="acc-here">esta sessão</span>
                      ) : (
                        <form action={revokeSession}>
                          <input type="hidden" name="sessao" value={s.publicId} />
                          <button type="submit" className="btn btn--ghost btn--sm">
                            Encerrar
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            {others > 0 ? (
              <form action={revokeOtherSessions} className="acc-after">
                <button type="submit" className="btn btn--ghost btn--sm">
                  Encerrar as outras {others === 1 ? "sessão" : `${others} sessões`}
                </button>
              </form>
            ) : null}
          </section>

          <section className="acc-section" aria-labelledby="seguranca">
            <div className="acc-head">
              <h2 id="seguranca">Segurança</h2>
            </div>
            <div className="acc-block">
              <div className="acc-block-head">
                <h3>Senha</h3>
                <p>Trocada em {full.format(user.passwordChangedAt)}.</p>
              </div>
              <PasswordForm email={user.email} name={user.name} />
            </div>
            <div className="acc-block" id="duas-etapas">
              <div className="acc-block-head">
                <h3>Verificação em duas etapas</h3>
                <p>
                  {user.totp.enabled
                    ? `Ligada desde ${full.format(user.totp.enabledAt ?? user.updatedAt)}. Cada entrada pede o código do app autenticador.`
                    : "Desligada. Com ela, a senha sozinha não basta para entrar: também pedimos um código do seu celular."}
                </p>
              </div>
              {user.totp.enabled ? (
                <DisableTotpForm />
              ) : (
                <Link href="/conta/duas-etapas" className="btn btn--sm">
                  <ShieldCheck aria-hidden />
                  Ligar a verificação
                </Link>
              )}
            </div>
            <div className="acc-block">
              <div className="acc-block-head">
                <h3>Códigos de recuperação</h3>
                <p>
                  <span className="num acc-inline-num">{codesLeft}</span> de 10 ainda valem.{" "}
                  {codesLeft <= 3 ? "Gere códigos novos antes que acabem." : "Guarde-os fora deste aparelho."}
                </p>
              </div>
              <RecoveryCodesForm email={user.email} needsCode={user.totp.enabled} />
            </div>
          </section>

          <section className="acc-section" aria-labelledby="perfil">
            <div className="acc-head">
              <h2 id="perfil">Perfil</h2>
            </div>
            <dl className="details acc-details">
              <dt>E-mail</dt>
              <dd>{user.email}</dd>
              <dt>Na conta desde</dt>
              <dd>{full.format(user.createdAt)}</dd>
            </dl>
            <NameForm name={user.name} />
          </section>

          <section className="acc-section" aria-labelledby="registro">
            <div className="acc-head">
              <h2 id="registro">Registro de segurança</h2>
            </div>
            <p className="acc-intro">
              {log.length === 1 ? "A última ocorrência." : `As últimas ${log.length} ocorrências.`} Guardamos cada uma por 180 dias.
            </p>
            <ol className="acc-log">
              {log.map((e) => (
                <li key={e._id?.toHexString()} data-alert={ALERT_EVENTS.has(e.type) || undefined}>
                  <span className="acc-time">
                    <b className="num">{time.format(e.at)}</b>
                    <small>{dayLabel(e.at)}</small>
                  </span>
                  <span className="acc-what">
                    <strong>{EVENT_LABEL[e.type] ?? e.type}</strong>
                    <small>{[describeDevice(e.userAgent), e.place, e.ip].filter(Boolean).join(" · ")}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="acc-section acc-danger" aria-labelledby="excluir">
            <div className="acc-head">
              <h2 id="excluir">Excluir conta</h2>
            </div>
            <p className="acc-intro">
              Apaga sua conta, sessões e registro de segurança. Não dá para desfazer.
            </p>
            <DeleteAccountForm needsCode={user.totp.enabled} />
          </section>
        </div>

        <aside className="acc-aside">
          <div className="buy-card acc-card">
            <h2>Resumo</h2>
            <dl>
              <div>
                <dt>Duas etapas</dt>
                <dd data-on={user.totp.enabled}>{user.totp.enabled ? "Ligada" : "Desligada"}</dd>
              </div>
              <div>
                <dt>Códigos de recuperação</dt>
                <dd className="num">{codesLeft}/10</dd>
              </div>
              <div>
                <dt>Sessões abertas</dt>
                <dd className="num">{active.length}</dd>
              </div>
            </dl>
            {!user.totp.enabled ? (
              <Link href="/conta/duas-etapas" className="btn">
                <ShieldCheck aria-hidden />
                Ligar duas etapas
              </Link>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="btn btn--ghost acc-out">
                <LogOut aria-hidden />
                Sair desta sessão
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
