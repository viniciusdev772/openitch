"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { verifySecondFactor, type FormState } from "@/lib/auth/actions";
import { Field, FormAlert, Submit } from "@/components/auth/Fields";

export function VerifyForm({ de, expiresAt }: { de: string; expiresAt: number }) {
  const [state, action] = useActionState<FormState, FormData>(verifySecondFactor, undefined);
  const [recovery, setRecovery] = useState(false);
  const left = useCountdown(expiresAt);

  return (
    <form action={action} className="bo-sheet" noValidate>
      <FormAlert error={state?.error} />
      <input type="hidden" name="de" value={de} />
      <p className="bo-clock" aria-live="off">
        <span className="num">{left}</span>
        <span>para digitar o código</span>
      </p>
      {recovery ? (
        <Field
          key="recuperacao"
          label="Código de recuperação"
          name="codigo"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="k7m2q-x9c4d"
          maxLength={20}
          className="bo-code-input"
          autoFocus
          error={state?.fields?.codigo}
          hint="Cada código de recuperação funciona uma vez."
        />
      ) : (
        <Field
          key="app"
          label="Código do app autenticador"
          name="codigo"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          placeholder="000000"
          maxLength={7}
          className="bo-otp"
          autoFocus
          error={state?.fields?.codigo}
          hint="Seis dígitos. O código muda a cada 30 segundos."
        />
      )}
      <div className="bo-row">
        <button type="button" className="bo-link" onClick={() => setRecovery((r) => !r)}>
          {recovery ? "Usar o código do app" : "Sem o celular? Use um código de recuperação"}
        </button>
        <Submit pendingLabel="Conferindo">Confirmar e entrar</Submit>
      </div>
      <p className="bo-foot">
        <Link href="/entrar">Voltar e entrar com outra conta</Link>
      </p>
    </form>
  );
}

function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((until - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
