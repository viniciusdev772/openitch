import Link from "next/link";
import { LibraryBig } from "lucide-react";
import { ButtonReplica } from "./ButtonReplica";
import type { ShelfPerson } from "./shelf-types";

/** Estante vazia: ensina com as cópias dos botões e aponta os criadores. Renderiza no servidor. */
export function FirstUse({ creators }: { creators: ShelfPerson[] }) {
  return (
    <div className="wrap shelf shelf--first">
      <section className="shelf-start" aria-labelledby="vazia">
        <LibraryBig aria-hidden className="shelf-start-icon" />
        <h2 id="vazia">Sua estante está vazia</h2>
        <p className="shelf-start-lead">
          Aqui ficam os jogos que você guardar para jogar depois, os criadores que você seguir e os jogos novos de
          cada um deles.
        </p>
        <ul className="shelf-how">
          <li>
            <ButtonReplica kind="save" />
            <p>
              <strong>Na página de um jogo.</strong> O jogo entra na lista com o preço e a data em que você guardou.
            </p>
          </li>
          <li>
            <ButtonReplica kind="follow" />
            <p>
              <strong>Na página de um criador.</strong> Cada jogo novo dele aparece em Novidades, o mais recente
              primeiro.
            </p>
          </li>
        </ul>
        <div className="shelf-start-go">
          <Link href="/jogos" className="btn">
            Abrir o catálogo
          </Link>
        </div>
      </section>

      <section className="acc-section shelf-people-pick" aria-labelledby="criadores">
        <div className="acc-head">
          <h2 id="criadores">Criadores no programa</h2>
        </div>
        <p className="acc-intro">Abra a página de quem te interessa e use Seguir.</p>
        <ol className="shelf-list shelf-list--people">
          {creators.map((c) => (
            <li key={c.slug}>
              <span className="shelf-title">
                <Link href={`/criador/${c.slug}`}>
                  <h3>{c.name}</h3>
                </Link>
                <small>
                  {c.city} · <span className="num">{c.count}</span> {c.count === 1 ? "jogo" : "jogos"}
                </small>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
