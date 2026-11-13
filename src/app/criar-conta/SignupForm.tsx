"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signUp, type FormState } from "@/lib/auth/actions";
import { Field, FormAlert, PasswordField, Remember, Submit } from "@/components/auth/Fields";
import { RecoveryCodes } from "@/components/auth/RecoveryCodes";

/**
 * A página sempre renderiza este componente, mesmo com sessão: o Next
 * re-renderiza a rota quando a ação grava o cookie, e trocar o componente ali
 * apagaria os códigos de recuperação antes de a pessoa guardá-los.
 */
export function SignupForm({ de, signedIn }: { de: string; signedIn: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    // A conta já entrou: o cabeçalho do site precisa saber.
    if (state?.codes) window.dispatchEvent(new Event("openitch:sessao"));
  }, [state?.codes]);

  if (state?.codes) {
    return (
      <div className="bo-sheet">
        <p className="bo-ok" role="status">
          Conta criada. Você já está dentro.
        </p>
        <RecoveryCodes codes={state.codes} email={email} continueHref={de} continueLabel="Ir para minha conta" />
      </div>
    );
  }

  if (signedIn) {
    return (
      <div className="bo-sheet">
        <p>Você já está dentro de uma conta neste navegador.</p>
        <div className="bo-row bo-row--end">
          <Link href="/conta" className="btn">
            Ir para minha conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="bo-sheet" noValidate>
      <FormAlert error={state?.error} />
      <Field
        label="Nome"
        name="nome"
        autoComplete="name"
        required
        maxLength={60}
        defaultValue={state?.values?.nome ?? ""}
        onChange={(e) => setName(e.target.value)}
        error={state?.fields?.nome}
        hint="Aparece na sua página de criador. Pode ser um apelido."
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        defaultValue={state?.values?.email ?? ""}
        onChange={(e) => setEmail(e.target.value)}
        error={state?.fields?.email}
      />
      <PasswordField
        label="Senha"
        name="senha"
        autoComplete="new-password"
        meter
        context={[name, email]}
        error={state?.fields?.senha}
        hint="Pelo menos 10 caracteres. Uma frase com espaços é fácil de lembrar e difícil de adivinhar."
      />
      <div className="bo-row">
        <Remember defaultChecked />
        <Submit pendingLabel="Criando a conta">Criar conta</Submit>
      </div>
      <p className="bo-foot">
        <span>
          Já tem conta? <Link href="/entrar">Entrar</Link>
        </span>
      </p>
    </form>
  );
}
