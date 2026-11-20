import { providerEnabled, providerLabel, type ProviderId } from "@/lib/auth/oauth";

const IDS: ProviderId[] = ["google", "resumestre"];

/** Links comuns (não <Link>): o start redireciona para fora e não pode ser pré-carregado. */
export function OAuthButtons({ from, de }: { from: "entrar" | "criar-conta"; de: string }) {
  const on = IDS.filter(providerEnabled);
  if (!on.length) return null;
  return (
    <div className="sso">
      <p className="sso-or">ou</p>
      {on.map((id) => (
        <a key={id} className="btn btn-sso" href={`/api/auth/${id}/start?p=${from}&de=${encodeURIComponent(de)}`}>
          <span className="sso-mark" aria-hidden />
          Entrar com {providerLabel(id)}
          <span className="sso-arrow" aria-hidden>→</span>
        </a>
      ))}
    </div>
  );
}
