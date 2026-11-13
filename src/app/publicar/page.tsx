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

  // Um rascunho pode apontar para uma jam que saiu da agenda: o campo volta a "nenhuma jam",
  // senão o rascunho não salvaria de novo.
  const staleJam = Boolean(draft?.jam && !jamBySlug(draft.jam));
  if (draft && staleJam) draft = { ...draft, jam: "" };
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
          <h1>{draft?.state === "publicado" ? "Editar" : "Publicar"}</h1>
          <p>
            {draft
              ? `${
                  draft.state === "publicado"
                    ? "Você está editando um jogo publicado. Mude o que quiser: cada gravação vai ao ar na hora. No passo 6 dá para tirar do ar ou excluir."
                    : "Você está editando um rascunho salvo. Mude o que quiser e salve de novo; a entrada à direita acompanha cada letra."
                }${
                  staleJam ? " A jam que este rascunho tinha não está mais na agenda, então o campo de jam ficou vazio." : ""
                }`
              : "Preencha os cinco passos na ordem. Dá para mudar tudo depois, e a sua entrada no programa, à direita, muda enquanto você escreve."}
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
