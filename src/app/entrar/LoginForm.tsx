"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "@/lib/auth/actions";
import { Field, FormAlert, PasswordField, Remember, Submit } from "@/components/auth/Fields";

export function LoginForm({ de, notice }: { de: string; notice?: { tone: "ok" | "error"; text: string } }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, undefined);
  const error = state?.error ?? (notice?.tone === "error" ? notice.text : undefined);
  const ok = !state && notice?.tone === "ok" ? notice.text : undefined;
  return (
    <form action={action} className="bo-sheet" noValidate>
      <FormAlert error={error} ok={ok} />
      <input type="hidden" name="de" value={de} />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        defaultValue={state?.values?.email ?? ""}
        error={state?.fields?.email}
      />
      <PasswordField label="Senha" name="senha" autoComplete="current-password" error={state?.fields?.senha} />
      <div className="bo-row">
        <Remember />
        <Submit pendingLabel="Conferindo">Entrar</Submit>
      </div>
      <p className="bo-foot">
        <span>
          Primeira vez aqui? <Link href={`/criar-conta${de !== "/conta" ? `?de=${encodeURIComponent(de)}` : ""}`}>Criar conta</Link>
        </span>
        <Link href="/recuperar">Esqueci a senha</Link>
      </p>
    </form>
  );
}
