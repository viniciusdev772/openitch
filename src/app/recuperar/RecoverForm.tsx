"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { recoverAccess, type FormState } from "@/lib/auth/actions";
import { Field, FormAlert, PasswordField, Submit } from "@/components/auth/Fields";

export function RecoverForm() {
  const [state, action] = useActionState<FormState, FormData>(recoverAccess, undefined);
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="bo-sheet" noValidate>
      <FormAlert error={state?.error} />
      <Field
        label="E-mail da conta"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        defaultValue={state?.values?.email ?? ""}
        onChange={(e) => setEmail(e.target.value)}
        error={state?.fields?.email}
      />
      <Field
        label="Código de recuperação"
        name="codigo"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={20}
        placeholder="k7m2q-x9c4d"
        className="bo-code-input"
        error={state?.fields?.codigo}
        hint="Um dos 10 códigos que você guardou ao criar a conta. Ele deixa de valer depois de usado."
      />
      <PasswordField
        label="Senha nova"
        name="senha"
        autoComplete="new-password"
        meter
        context={[email]}
        error={state?.fields?.senha}
        hint="Pelo menos 10 caracteres."
      />
      <div className="bo-row bo-row--end">
        <Submit pendingLabel="Salvando">Salvar senha nova</Submit>
      </div>
      <p className="bo-foot">
        <span>
          Lembrou? <Link href="/entrar">Entrar</Link>
        </span>
      </p>
    </form>
  );
}
