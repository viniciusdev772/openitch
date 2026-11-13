import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Masthead } from "@/components/Masthead";
import { Colophon } from "@/components/Colophon";
import { ThumbIndex } from "@/components/ThumbIndex";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: { default: "VibeGames · programa permanente de jogos independentes", template: "%s · VibeGames" },
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
