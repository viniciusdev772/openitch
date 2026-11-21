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

/*
 * Capas e capturas de tela ficam no bucket jogável, sob b/capa-<aleatório>/ (mesma URL de
 * publicUrl em src/lib/storage/s3.ts). O next/image só otimiza essa pasta, nunca arquivos de jogo.
 * Cada envio ganha uma chave nova, então o cache longo é seguro; quando uma imagem é apagada,
 * forgetOptimized (src/lib/projects/cover-store.ts) tira as versões otimizadas do cache na hora.
 */
const storage = (process.env.S3_PLAY_PUBLIC_URL || process.env.S3_ENDPOINT || "").replace(/\/+$/, "");
const coverImages = storage ? [new URL(`${storage}/${process.env.S3_BUCKET_PLAY || "vibegames-play"}/b/capa-*/**`)] : [];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["mongodb"],
  images: {
    remotePatterns: coverImages,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400, // 31 dias
  },
  // Links antigos da lista de criadores em ordem alfabética: a página estática é /criadores/az.
  // beforeFiles porque /criadores também existe; um rewrite comum só roda quando nenhuma página bate.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/criadores", has: [{ type: "query", key: "ordem", value: "az" }], destination: "/criadores/az" }],
      afterFiles: [],
      fallback: [],
    };
  },
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
