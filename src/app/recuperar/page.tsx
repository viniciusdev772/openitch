import type { Metadata } from "next";
import { BoxBody, BoxHead, Notes } from "@/components/auth/BoxOffice";
import { RecoverForm } from "./RecoverForm";

export const metadata: Metadata = { title: "Recuperar acesso", robots: { index: false } };

export default function RecuperarPage() {
  return (
    <>
      <BoxHead title="Recuperar acesso">
        <p>Esqueceu a senha? Use um código de recuperação para criar uma senha nova.</p>
      </BoxHead>
      <BoxBody
        notes={
          <Notes
            title="O que acontece"
            items={[
              ["Ao salvar", "A senha antiga para de funcionar e todas as sessões abertas são encerradas, em qualquer aparelho."],
              ["O código", "Fica marcado como usado. Os outros nove continuam valendo."],
              ["Duas etapas", "Se estiver ligada, continua ligada: o app ainda vai pedir o código na próxima entrada."],
              ["Sem códigos", "Sem um código de recuperação não há como provar que a conta é sua, nem para nós."],
            ]}
          />
        }
      >
        <RecoverForm />
      </BoxBody>
    </>
  );
}
