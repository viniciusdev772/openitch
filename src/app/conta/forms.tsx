"use client";

import { useActionState, useEffect, useState } from "react";
import {
  changePassword,
  deleteAccount,
  disableTotp,
  regenerateRecoveryCodes,
  updateName,
  type FormState,
} from "@/lib/auth/actions";
import { Field, FormAlert, PasswordField, Submit } from "@/components/auth/Fields";
import { RecoveryCodes } from "@/components/auth/RecoveryCodes";

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateName, undefined);
  useEffect(() => {
    // O cabeçalho do site mostra o nome: avisa que mudou.
    if (state?.ok) window.dispatchEvent(new Event("openitch:sessao"));
  }, [state]);
  return (
    <form action={action} className="acc-form" noValidate>
      <FormAlert error={state?.error} ok={state?.ok} />
      <Field
        label="Nome"
        name="nome"
        autoComplete="name"
        required
        maxLength={60}
        defaultValue={state?.values?.nome ?? name}
        error={state?.fields?.nome}
      />
      <div className="bo-row bo-row--end">
        <Submit pendingLabel="Salvando" className="btn--sm">
          Salvar nome
        </Submit>
      </div>
    </form>
  );
}

export function PasswordForm({ email, name }: { email: string; name: string }) {
  const [state, action] = useActionState<FormState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="acc-form" noValidate key={state?.ok ? "ok" : "form"}>
      <FormAlert error={state?.error} ok={state?.ok} />
      <input type="email" name="usuario" autoComplete="username" value={email} readOnly hidden />
      <PasswordField label="Senha atual" name="senha_atual" autoComplete="current-password" error={state?.fields?.senha_atual} />
      <PasswordField
        label="Senha nova"
        name="senha_nova"
        autoComplete="new-password"
        meter
        context={[email, name]}
        error={state?.fields?.senha_nova}
        hint="Ao trocar, as sessões em outros aparelhos são encerradas."
      />
      <div className="bo-row bo-row--end">
        <Submit pendingLabel="Trocando" className="btn--sm">
          Trocar senha
        </Submit>
      </div>
    </form>
  );
}

export function DisableTotpForm() {
  const [state, action] = useActionState<FormState, FormData>(disableTotp, undefined);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <FormAlert ok={state.ok} />;
  if (!open) {
    return (
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
        Desligar
      </button>
    );
  }
  return (
    <form action={action} className="acc-form" noValidate>
      <FormAlert error={state?.error} />
      <p className="acc-warn">Sem a segunda etapa, quem descobrir sua senha entra na conta.</p>
      <PasswordField label="Senha" name="senha" autoComplete="current-password" error={state?.fields?.senha} />
      <Field
        label="Código do app ou de recuperação"
        name="codigo"
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        error={state?.fields?.codigo}
      />
      <div className="bo-row bo-row--end">
        <button type="button" className="bo-link" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <Submit pendingLabel="Desligando" className="btn--sm">
          Desligar a verificação
        </Submit>
      </div>
    </form>
  );
}

export function RecoveryCodesForm({ email, needsCode }: { email: string; needsCode: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(regenerateRecoveryCodes, undefined);
  const [open, setOpen] = useState(false);
  if (state?.codes) return <RecoveryCodes codes={state.codes} email={email} />;
  if (!open) {
    return (
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
        Gerar códigos novos
      </button>
    );
  }
  return (
    <form action={action} className="acc-form" noValidate>
      <FormAlert error={state?.error} />
      <p className="acc-warn">Os códigos atuais param de valer assim que os novos forem gerados.</p>
      <input type="email" name="usuario" autoComplete="username" value={email} readOnly hidden />
      <PasswordField label="Senha" name="senha" autoComplete="current-password" error={state?.fields?.senha} />
      {needsCode ? (
        <Field
          label="Código do app autenticador"
          name="codigo"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          placeholder="000000"
          maxLength={7}
          className="bo-otp"
          error={state?.fields?.codigo}
        />
      ) : null}
      <div className="bo-row bo-row--end">
        <button type="button" className="bo-link" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <Submit pendingLabel="Gerando" className="btn--sm">
          Gerar 10 códigos novos
        </Submit>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ needsCode }: { needsCode: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(deleteAccount, undefined);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn--ghost btn--sm acc-danger-btn" onClick={() => setOpen(true)}>
        Excluir minha conta
      </button>
    );
  }
  return (
    <form action={action} className="acc-form" noValidate>
      <FormAlert error={state?.error} />
      <PasswordField label="Senha" name="senha" autoComplete="current-password" error={state?.fields?.senha} />
      {needsCode ? (
        <Field
          label="Código do app ou de recuperação"
          name="codigo"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          error={state?.fields?.codigo}
        />
      ) : null}
      <Field
        label="Escreva excluir para confirmar"
        name="confirmacao"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        error={state?.fields?.confirmacao}
      />
      <div className="bo-row bo-row--end">
        <button type="button" className="bo-link" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <Submit pendingLabel="Excluindo" className="btn--sm acc-danger-btn">
          Excluir conta para sempre
        </Submit>
      </div>
    </form>
  );
}
