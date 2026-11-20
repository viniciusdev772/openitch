import type { DownloadPlatform } from "@/lib/uploads/rules";

/*
 * Lista de arquivos de um jogo, lida do HTML público do itch.io (página do jogo,
 * para jogos grátis, ou a página de downloads). Sem rede: testável fora do Next.
 *
 *   <div class="upload"><a class="button download_btn" data-upload_id="20677440">…
 *     <strong class="name" title="Jogo-win64.zip">…</strong>
 *     <span class="file_size"><span>837 MB</span></span>
 *     <span class="download_platforms"><span class="icon icon-windows8"></span>…
 *
 * ponytail: lê o HTML com expressões simples; se o itch mudar essa marcação,
 * a lista sai vazia e o criador envia os arquivos à mão (nada quebra).
 */

export interface ItchUpload {
  id: number;
  filename: string;
  /** Tamanho como o itch mostra ("837 MB"); o exato vem do CDN na hora de copiar. */
  sizeLabel: string;
  /** Plataformas de download (na ordem windows, macos, linux, android); vazio = outro tipo de arquivo. */
  platforms: DownloadPlatform[];
}

const ICONS: [RegExp, DownloadPlatform][] = [
  [/icon-windows/, "windows"],
  [/icon-apple/, "macos"],
  [/icon-tux/, "linux"],
  [/icon-android/, "android"],
];

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export function parseUploadList(html: string): ItchUpload[] {
  const out: ItchUpload[] = [];
  const blocks = html.split(/<div\s+class="upload"\s*>/i).slice(1);
  for (const b of blocks) {
    const id = Number(/data-upload_id="(\d+)"/.exec(b)?.[1]);
    if (!Number.isSafeInteger(id) || id <= 0 || out.some((u) => u.id === id)) continue;
    const name = /<strong\b[^>]*class="name"[^>]*title="([^"]*)"/.exec(b)?.[1] ?? /<strong\b[^>]*title="([^"]*)"[^>]*class="name"/.exec(b)?.[1];
    const size = /class="file_size"[^>]*>\s*<span>([^<]*)</.exec(b)?.[1] ?? "";
    const icons = /class="download_platforms"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/.exec(b)?.[1] ?? "";
    const filename = decode(name ?? "").trim() || `arquivo-${id}`;
    const platforms = ICONS.filter(([re]) => re.test(icons)).map(([, p]) => p);
    if (!platforms.length && /\.apk$/i.test(filename)) platforms.push("android");
    out.push({ id, filename, sizeLabel: decode(size).trim(), platforms });
  }
  return out;
}

/** Validade do link assinado do CDN (parâmetro Expires, em segundos), ou null. */
export function cdnExpiry(url: string): Date | null {
  try {
    const e = Number(new URL(url).searchParams.get("Expires"));
    return Number.isFinite(e) && e > 0 ? new Date(e * 1000) : null;
  } catch {
    return null;
  }
}
