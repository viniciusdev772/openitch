import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas. A política de conteúdo não
 * restringe scripts (o Next injeta scripts inline), mas fecha o que importa
 * para as telas de login: ninguém embute o site num iframe (clickjacking),
 * formulários só enviam para cá e <base> não pode ser trocado.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["mongodb"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      /*
       * Prévia de um build que usa threads (SharedArrayBuffer): a página que
       * embute o jogo também precisa de COEP para o iframe ficar isolado
       * (crossOriginIsolated). Só com ?isolado=1, que a própria página pede
       * depois que o service worker do build está ativo (src/lib/builds/coi.ts);
       * sem ele, o iframe do MinIO (que não manda CORP) seria bloqueado.
       */
      {
        source: "/jogar/:id",
        has: [{ type: "query", key: "isolado", value: "1" }],
        headers: [{ key: "Cross-Origin-Embedder-Policy", value: "require-corp" }],
      },
    ];
  },
};

export default nextConfig;
