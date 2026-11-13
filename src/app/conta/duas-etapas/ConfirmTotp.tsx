"use client";

import { useActionState } from "react";
import { confirmTotpSetup, type FormState } from "@/lib/auth/actions";
import { Field, FormAlert, Submit } from "@/components/auth/Fields";

export function ConfirmTotp() {
  const [state, action] = useActionState<FormState, FormData>(confirmTotpSetup, undefined);
  return (
    <form action={action} className="acc-form" noValidate>
      <FormAlert error={state?.error} />
      <Field
        label="Código que o app mostra agora"
        name="codigo"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        placeholder="000000"
        maxLength={7}
        className="bo-otp"
        error={state?.fields?.codigo}
      />
      <div className="bo-row bo-row--end">
        <Submit pendingLabel="Conferindo">Ligar a verificação</Submit>
      </div>
    </form>
  );
}
