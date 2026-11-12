import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap" style={{ paddingTop: 96, paddingBottom: 128 }}>
      <div className="empty">
        <h2>Esta entrada não está no programa</h2>
        <p>O endereço pode ter mudado ou o jogo foi retirado por quem fez. O catálogo tem todas as entradas atuais.</p>
        <Link className="btn" href="/jogos">
          Abrir o catálogo
        </Link>
      </div>
    </section>
  );
}
