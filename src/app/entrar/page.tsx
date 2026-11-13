import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoxBody, BoxHead, Notes } from "@/components/auth/BoxOffice";
import { getSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/validate";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  expirou: { tone: "error", text: "O tempo para digitar o código acabou. Entre de novo com sua senha." },
  tentativas: { tone: "error", text: "Muitos códigos errados. Por segurança, entre de novo com sua senha." },
  redefinida: { tone: "ok", text: "Senha nova salva e todas as sessões antigas encerradas. Entre com a senha nova." },
};

type SP = Promise<{ de?: string | string[]; motivo?: string | string[] }>;

export default async function EntrarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const de = safeNext(typeof sp.de === "string" ? sp.de : null);
  const motivo = typeof sp.motivo === "string" ? NOTICES[sp.motivo] : undefined;
  const session = await getSession().catch(() => null);
  if (session) redirect(de);

  return (
    <>
      <BoxHead title="Entrar">
        <p>A bilheteria do programa. Entre para publicar, acompanhar seus jogos e cuidar da sua conta.</p>
      </BoxHead>
      <BoxBody
        notes={
          <Notes
            title="Como funciona"
            items={[
              ["Tentativas", "Cinco senhas erradas seguidas, da mesma rede, pausam as entradas neste e-mail por 15 minutos."],
              ["Duas etapas", "Se você ligou a verificação em duas etapas, pedimos o código do app depois da senha."],
              ["Sessão", "Sem “manter conectado”, a sessão acaba ao fechar o navegador ou depois de 2 horas parada."],
              ["Senha esquecida", "Você volta com um dos códigos de recuperação que recebeu ao criar a conta."],
            ]}
          />
        }
      >
        <LoginForm de={de} notice={motivo} />
      </BoxBody>
    </>
  );
}
