import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Masthead } from "@/components/Masthead";
import { Colophon } from "@/components/Colophon";
import { ThumbIndex } from "@/components/ThumbIndex";
import { Suspense } from "react";

export const metadata: Metadata = {
  // Troque SITE_URL para https://portaldosgames.com.br quando o domínio estiver ativo.
  metadataBase: new URL(process.env.SITE_URL || "https://openitch.vercel.app"),
  applicationName: "Portal dos Games",
  title: { default: "Portal dos Games · programa permanente de jogos independentes", template: "%s · Portal dos Games" },
  description:
    "Publique seu jogo independente e deixe as pessoas jogarem direto no navegador, de graça e sem conta.",
};

export const viewport: Viewport = {
  themeColor: "#2b2fe3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Masthead />
        <Suspense>
          <ThumbIndex />
        </Suspense>
        <main id="conteudo">{children}</main>
        <Colophon />
      </body>
    </html>
  );
}
