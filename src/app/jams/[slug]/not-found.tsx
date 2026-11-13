import Link from "next/link";

export default function JamNotFound() {
  return (
    <section className="wrap" style={{ paddingTop: 96, paddingBottom: 128 }}>
      <div className="empty">
        <h2>Esta jam não está na agenda</h2>
        <p>O endereço pode ter mudado ou a jam foi retirada por quem organiza. A agenda tem todas as jams atuais e encerradas.</p>
        <Link className="btn" href="/jams">
          Abrir a agenda de jams
        </Link>
      </div>
    </section>
  );
}
