import Link from "next/link";
import "@/styles/etiquetas.css";

export default function TagNotFound() {
  return (
    <section className="wrap tag-missing">
      <div className="empty">
        <h2>Nenhum jogo leva esta etiqueta</h2>
        <p>
          O endereço pode ter um erro de digitação, ou a etiqueta saiu do último jogo que a usava. O índice mostra todas as
          que existem agora.
        </p>
        <Link className="btn" href="/etiquetas">
          Abrir o índice de etiquetas
        </Link>
      </div>
    </section>
  );
}
