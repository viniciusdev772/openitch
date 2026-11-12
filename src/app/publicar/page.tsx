import type { Metadata } from "next";
import { PublishForm } from "./PublishForm";

export const metadata: Metadata = { title: "Publicar um jogo" };

export default function PublishPage() {
  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <h1>Publicar</h1>
          <p>
            Cinco passos, nesta ordem, todos reversíveis. À direita está a sua entrada no programa: ela muda enquanto você escreve.
          </p>
        </div>
      </header>
      <PublishForm />
    </>
  );
}
