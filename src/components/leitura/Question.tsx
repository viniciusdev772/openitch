import { Link2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One question of the guide, printed as a ruled term/definition pair:
 * the question in the condensed face on the left, the answer in the reading
 * face on the right. Each question has its own anchor.
 */
export function Question({ id, q, children }: { id: string; q: string; children: ReactNode }) {
  return (
    <div className="qa">
      <h3 id={id}>
        {q}
        <a className="qa-anchor" href={`#${id}`} aria-label={`Link para a pergunta: ${q}`}>
          <Link2 aria-hidden size={16} />
        </a>
      </h3>
      <div className="qa-answer">{children}</div>
    </div>
  );
}
