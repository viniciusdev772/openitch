import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Masthead } from "@/components/Masthead";
import { Colophon } from "@/components/Colophon";

export const metadata: Metadata = {
  title: { default: "openitch · programa permanente de jogos independentes", template: "%s · openitch" },
  description:
    "Publique seu jogo independente, defina o preço (ou nenhum) e deixe as pessoas jogarem direto no navegador.",
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
        <main id="conteudo">{children}</main>
        <Colophon />
      </body>
    </html>
  );
}
