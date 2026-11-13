"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { scorePassword } from "./strength";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export function Field({ label, name, error, hint, id, className, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? `${name}-${auto}`;
  const hintId = hint ? `${inputId}-dica` : undefined;
  const errId = error ? `${inputId}-erro` : undefined;
  return (
    <div className="bo-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={`input${className ? ` ${className}` : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errId, hintId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {error ? (
        <p className="field-error" id={errId} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const LEVELS = ["Fraca demais", "Fraca", "Razoável", "Boa", "Forte"];

export function PasswordField({
  label,
  name,
  error,
  hint,
  autoComplete,
  meter = false,
  context = [],
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  autoComplete: "current-password" | "new-password";
  meter?: boolean;
  context?: string[];
}) {
  const auto = useId();
  const inputId = `${name}-${auto}`;
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState("");
  const score = meter && value ? scorePassword(value, context) : null;
  const errId = error ? `${inputId}-erro` : undefined;
  const hintId = hint ? `${inputId}-dica` : undefined;
  const meterId = meter ? `${inputId}-forca` : undefined;
  return (
    <div className="bo-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="bo-pass">
        <input
          id={inputId}
          name={name}
          type={shown ? "text" : "password"}
          className="input"
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={512}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errId, meterId, hintId].filter(Boolean).join(" ") || undefined}
        />
        <button
          type="button"
          className="bo-reveal"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={inputId}
          aria-label={shown ? "Esconder senha" : "Mostrar senha"}
        >
          {shown ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
        </button>
      </div>
      {meter ? (
        <div className="bo-meter" id={meterId} data-score={score ?? -1} aria-live="polite">
          <span className="bo-meter-cells" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <i key={i} data-on={score !== null && score >= i} />
            ))}
          </span>
          <span className="bo-meter-label">{score === null ? "Força da senha" : LEVELS[score]}</span>
        </div>
      ) : null}
      {error ? (
        <p className="field-error" id={errId} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Submit({ children, pendingLabel, className }: { children: ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn${className ? ` ${className}` : ""}`} disabled={pending} aria-disabled={pending}>
      {pending ? <LoaderCircle aria-hidden className="bo-spin" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormAlert({ error, ok }: { error?: string; ok?: string }) {
  if (error) {
    return (
      <p className="bo-alert" role="alert">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="bo-ok" role="status">
        {ok}
      </p>
    );
  }
  return null;
}

export function Remember({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const id = useId();
  return (
    <div className="bo-check">
      <input type="checkbox" id={id} name="lembrar" defaultChecked={defaultChecked} />
      <label htmlFor={id}>
        Manter conectado neste aparelho
        <small>Até 30 dias. Desmarcado, a sessão acaba ao fechar o navegador.</small>
      </label>
    </div>
  );
}
