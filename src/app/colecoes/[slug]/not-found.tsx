import Link from "next/link";
import "@/styles/colecoes.css";

export default function ColecaoNotFound() {
  return (
    <section className="wrap col-missing">
      <div className="empty">
        <h2>Esta coleção não está no programa</h2>
        <p>O endereço pode ter um erro de digitação, ou o bloco saiu do programa. O índice mostra as coleções que existem agora.</p>
        <Link className="btn" href="/colecoes">
          Abrir o índice de coleções
        </Link>
      </div>
    </section>
  );
}
