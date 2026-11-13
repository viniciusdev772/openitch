import Link from "next/link";
import { PLATFORMS, TRACKS } from "@/data/catalog";

export function Colophon() {
  return (
    <footer className="colophon">
      <div className="wrap">
        <div>
          <p className="big" aria-hidden>
            open<em>itch</em>
          </p>
          <p style={{ marginTop: 24, maxWidth: "40ch", fontSize: "1.0625rem" }}>
            Um programa aberto de jogos independentes. Quem faz, publica. Quem joga, escolhe quanto paga.
          </p>
        </div>
        <div>
          <h2>Programa</h2>
          <ul>
            <li><Link href="/jogos">Catálogo completo</Link></li>
            <li><Link href="/jams">Jams e agenda</Link></li>
            <li><Link href="/criadores">Criadores</Link></li>
            <li><Link href="/publicar">Publicar um jogo</Link></li>
          </ul>
        </div>
        <div>
          <h2>Guia</h2>
          <ul>
            <li><Link href="/sobre">Como funciona</Link></li>
            <li><Link href="/ajuda">Ajuda</Link></li>
            <li><Link href="/novidades">Novidades</Link></li>
          </ul>
        </div>
        <div>
          <h2>Trilhas</h2>
          <ul>
            {TRACKS.map((t) => (
              <li key={t.id}>
                <Link href={`/jogos?trilha=${t.id}`}>{t.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Legenda de plataformas</h2>
          <ul className="legend">
            {Object.values(PLATFORMS).map((p) => (
              <li key={p.code}>
                <span className="code" aria-hidden>{p.code}</span>
                {p.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="fine">
          <span>Contas já são reais. Pagamentos e envio de arquivos ainda não estão conectados.</span>
          <span>Todo o catálogo é material de amostra.</span>
        </div>
      </div>
    </footer>
  );
}
