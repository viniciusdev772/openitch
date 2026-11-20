import { providerEnabled, providerLabel, type ProviderId } from "@/lib/auth/oauth";

const IDS: ProviderId[] = ["google", "resumestre"];

/** Links comuns (não <Link>): o start redireciona para fora e não pode ser pré-carregado. */
export function OAuthButtons({ from, de }: { from: "entrar" | "criar-conta"; de: string }) {
  const on = IDS.filter(providerEnabled);
  if (!on.length) return null;
  return (
    <p className="bo-row bo-row--end">
      {on.map((id) => (
        <a key={id} className="btn btn--ghost" href={`/api/auth/${id}/start?p=${from}&de=${encodeURIComponent(de)}`}>
          Entrar com {providerLabel(id)}
        </a>
      ))}
    </p>
  );
}
