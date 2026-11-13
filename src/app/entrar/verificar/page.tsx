import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoxBody, BoxHead, Notes } from "@/components/auth/BoxOffice";
import { readMfaChallenge } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/validate";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ de?: string | string[] }> }) {
  const sp = await searchParams;
  const de = safeNext(typeof sp.de === "string" ? sp.de : null);
  const challenge = await readMfaChallenge();
  if (!challenge) redirect("/entrar?motivo=expirou");

  return (
    <>
      <BoxHead title="Mais um passo">
        <p>Sua senha está certa. Agora confirme que é você com o código do app autenticador.</p>
      </BoxHead>
      <BoxBody
        notes={
          <Notes
            title="Sobre o código"
            items={[
              ["Prazo", "Você tem 5 minutos e até 5 tentativas. Depois disso, pedimos a senha de novo."],
              ["Uso único", "Um código aceito não serve de novo, nem se alguém o vir na sua tela."],
              ["Sem o celular", "Use um dos códigos de recuperação. Ele também vale uma única vez."],
            ]}
          />
        }
      >
        <VerifyForm de={de} expiresAt={challenge.expiresAt.getTime()} />
      </BoxBody>
    </>
  );
}
