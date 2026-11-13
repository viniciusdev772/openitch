import type { Metadata } from "next";
import { BoxBody, BoxHead, Notes } from "@/components/auth/BoxOffice";
import { getSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/validate";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default async function CriarContaPage({ searchParams }: { searchParams: Promise<{ de?: string | string[] }> }) {
  const sp = await searchParams;
  const de = safeNext(typeof sp.de === "string" ? sp.de : null);
  const session = await getSession().catch(() => null);

  return (
    <>
      <BoxHead title="Criar conta">
        <p>Uma conta para publicar seus jogos e inscrevê-los em jams. Leva um minuto.</p>
      </BoxHead>
      <BoxBody
        notes={
          <Notes
            title="Antes de começar"
            items={[
              [
                "Senha",
                "Conferimos se ela já apareceu em vazamentos de outros sites. Para isso, mandamos só um pedaço do resumo dela, nunca a senha.",
              ],
              ["Recuperação", "Ao terminar você recebe 10 códigos de recuperação. Não há e-mail de redefinição: se esquecer a senha, só eles devolvem o acesso."],
              ["Proteção extra", "Depois, na sua conta, dá para ligar a verificação em duas etapas com um app autenticador."],
              ["Registro", "Guardamos as entradas na conta (aparelho e local aproximado) por 180 dias, visíveis só para você."],
            ]}
          />
        }
      >
        <SignupForm de={de} signedIn={Boolean(session)} />
      </BoxBody>
    </>
  );
}
