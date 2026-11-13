import "server-only";
import { headers } from "next/headers";

export interface RequestInfo {
  ip: string;
  userAgent: string;
  place: string | null;
}

/**
 * IP e local de quem fez o pedido. Na Vercel, x-real-ip e x-forwarded-for são
 * reescritos pela própria plataforma, então não dá para o visitante forjar.
 * Fora dela (desenvolvimento) o valor é só informativo.
 */
export async function requestInfo(): Promise<RequestInfo> {
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "desconhecido";
  const userAgent = (h.get("user-agent") ?? "").slice(0, 400);
  const city = safeDecode(h.get("x-vercel-ip-city"));
  const country = h.get("x-vercel-ip-country");
  const place = [city, country].filter(Boolean).join(", ") || null;
  return { ip: ip.slice(0, 64), userAgent, place: place ? place.slice(0, 80) : null };
}

function safeDecode(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

/** "Chrome · Windows", sem biblioteca: só os casos que importam. */
export function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /SamsungBrowser\//.test(ua)
          ? "Samsung Internet"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navegador";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "sistema desconhecido";
  return `${browser} · ${os}`;
}
