import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { BoxHead } from "@/components/auth/BoxOffice";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/auth/crypto";
import { base32, otpauthUri } from "@/lib/auth/totp";
import { startTotpSetup } from "@/lib/auth/actions";
import { encodeQr, qrSvgPath } from "@/lib/qr";
import { ConfirmTotp } from "./ConfirmTotp";

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default async function DuasEtapasPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?de=/conta/duas-etapas");
  const { user } = session;
  if (user.totp.enabled) redirect("/conta#duas-etapas");

  const pending =
    user.totpPending && user.totpPending.expiresAt.getTime() > Date.now()
      ? decryptSecret(user.totpPending.secret, `${user._id.toHexString()}:pendente`)
      : null;

  let qr: { path: string; dim: number } | null = null;
  let key = "";
  let uri = "";
  if (pending) {
    uri = otpauthUri(pending, user.email);
    qr = qrSvgPath(encodeQr(uri));
    key = base32(pending).match(/.{1,4}/g)?.join(" ") ?? "";
  }

  return (
    <>
      <BoxHead title="Duas etapas">
        <p>
          Depois da senha, pedimos um código de 6 dígitos que só o seu celular sabe. Mesmo que alguém descubra a senha, não
          entra.
        </p>
      </BoxHead>
      <div className="wrap acc acc--single">
        <div className="acc-main">
          <Link href="/conta" className="bo-back">
            <ArrowLeft aria-hidden size={18} />
            Voltar para a conta
          </Link>
          <ol className="steps">
            <li className="step" data-done={Boolean(pending)}>
              <span className="step-num" aria-hidden>
                1
              </span>
              <div>
                <h2>Instale um app autenticador</h2>
                <p>
                  Qualquer app que gere códigos TOTP serve: Google Authenticator, Microsoft Authenticator, 1Password,
                  Bitwarden, Aegis ou o app de senhas do iPhone.
                </p>
                {!pending ? (
                  <form action={startTotpSetup}>
                    <button type="submit" className="btn">
                      <Smartphone aria-hidden />
                      Já tenho o app, mostrar o código QR
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
            <li className="step" data-done={false} aria-disabled={!pending || undefined}>
              <span className="step-num" aria-hidden>
                2
              </span>
              <div>
                <h2>Escaneie com o app</h2>
                {pending && qr ? (
                  <div className="totp-pair">
                    <svg
                      className="totp-qr"
                      viewBox={`0 0 ${qr.dim} ${qr.dim}`}
                      role="img"
                      aria-label="Código QR para adicionar a VibeGames ao app autenticador"
                      shapeRendering="crispEdges"
                    >
                      <rect width={qr.dim} height={qr.dim} />
                      <path d={qr.path} />
                    </svg>
                    <div className="totp-key">
                      <p>Sem câmera? Digite esta chave no app, como conta “VibeGames”:</p>
                      <code>{key}</code>
                      <a href={uri} className="btn btn--ghost btn--sm">
                        Abrir no app deste aparelho
                      </a>
                      <p className="field-hint">A chave expira em 15 minutos se não for confirmada.</p>
                    </div>
                  </div>
                ) : (
                  <p>O código QR aparece aqui depois do passo 1.</p>
                )}
              </div>
            </li>
            <li className="step" aria-disabled={!pending || undefined}>
              <span className="step-num" aria-hidden>
                3
              </span>
              <div>
                <h2>Confirme com um código</h2>
                <p>Digite os 6 dígitos que o app mostra para a VibeGames. Assim sabemos que o celular e a conta estão em sintonia.</p>
                {pending ? <ConfirmTotp /> : null}
              </div>
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
