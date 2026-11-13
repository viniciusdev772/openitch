import "@/styles/projetos.css";
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { JAMS, jamBySlug } from "@/data/catalog";
import { jamState, pickNow } from "@/components/jams/clock";
import { getSession } from "@/lib/auth/session";
import { readDraft } from "@/lib/projects/rules";
import type { SavedDraft } from "@/lib/projects/limits";
import { PublishFormHost, type Account, type JamOption } from "./PublishForm";

export const metadata: Metadata = { title: "Publicar um jogo" };

type SP = Promise<{ projeto?: string | string[]; jam?: string | string[] }>;

const HEX_ID = /^[a-f0-9]{24}$/i;

export default async function PublishPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const projeto = typeof sp.projeto === "string" && HEX_ID.test(sp.projeto) ? sp.projeto : null;
  const asked = typeof sp.projeto === "string" && sp.projeto !== "";
  const jamParam = typeof sp.jam === "string" ? sp.jam : "";
  const jam = jamParam && jamBySlug(jamParam) ? jamParam : "";

  let account: Account = "visitante";
  let draft: SavedDraft | null = null;
  try {
    const session = await getSession();
    if (session) {
      account = "dentro";
      if (projeto) draft = await readDraft(session.user._id, projeto);
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("[publicar]", err);
    account = "indisponivel";
  }

  // Abrir um rascunho pede conta: entra e volta direto para ele.
  if (account === "visitante" && projeto) redirect(`/entrar?de=${encodeURIComponent(`/publicar?projeto=${projeto}`)}`);

  const missing = account === "dentro" && asked && !draft;
  const now = pickNow();
  const selected = draft?.jam || jam;
  const jams: JamOption[] = JAMS.map((j) => ({ slug: j.slug, title: j.title, start: j.start, end: j.end, state: jamState(j, now) }))
    .filter((j) => j.state !== "past" || j.slug === selected)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <h1>Publicar</h1>
          <p>
            {draft
              ? "Você está editando um rascunho salvo. Mude o que quiser e salve de novo; a entrada à direita acompanha cada letra."
              : "Cinco passos, nesta ordem, todos reversíveis. À direita está a sua entrada no programa: ela muda enquanto você escreve."}
          </p>
        </div>
      </header>
      <PublishFormHost
        // A chave é o que o formulário está editando: abrir outro rascunho, um novo, outra jam (ou um id que não
        // existe) recomeça o formulário; um novo render do servidor do mesmo endereço mantém o que está escrito.
        // O caso do rascunho que o próprio formulário acabou de criar fica com PublishFormHost.
        formKey={draft ? `rascunho:${draft.id}` : `novo:${jam}${missing ? ":faltando" : ""}`}
        account={account}
        initial={draft}
        jam={jam}
        jams={jams}
        missing={missing}
      />
    </>
  );
}
