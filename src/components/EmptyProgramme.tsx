import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * O programa ainda vazio: uma moldura tracejada ("vazio, coloque algo aqui",
 * no DESIGN.md) que diz o que vai aparecer e qual é o próximo passo.
 */
export function EmptyProgramme({
  title,
  children,
  action = { href: "/publicar", label: "Começar um rascunho" },
  secondary,
  headingLevel = 2,
}: {
  title: string;
  children: React.ReactNode;
  action?: { href: string; label: string } | null;
  secondary?: { href: string; label: string };
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="empty empty-programme">
      <H>{title}</H>
      <p>{children}</p>
      {action || secondary ? (
        <div className="empty-actions">
          {action ? (
            <Link className="btn" href={action.href}>
              {action.label} <ArrowRight aria-hidden />
            </Link>
          ) : null}
          {secondary ? (
            <Link className="btn btn--ghost" href={secondary.href}>
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
